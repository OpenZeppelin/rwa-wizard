'use strict';

/**
 * `provenance/no-early-config-read`
 *
 * Closes the compute-early-emit-late hazard in generator templates that record
 * line-level provenance: a value derived from config before an emission, used
 * after it, is attributed to the line that was current when it was *read*, not
 * to the lines it actually shapes. Nothing at runtime can see that, so it is
 * caught here.
 *
 * Purely syntactic — no type information, no `parserOptions.project`. Builders
 * are recognised by the core factory and type names; the config types a
 * generator passes around are named per package through the `configTypes`
 * option, so the rule itself stays chain-agnostic.
 *
 * Known limits (verified against the shipped rule; none is hit by a template
 * in this repo today, and the byte-identity and attribution suites are the
 * backstop for anything the syntax cannot see):
 *
 * - An emission inside a callback (`.forEach`, `.map`) is not counted as an
 *   intervening emission for a hoist in the enclosing function.
 * - A helper reached as a member (`helpers.header(b)`) or a builder passed
 *   inside an object literal (`emit({ sink: b })`) is not followed.
 * - Only `const`/`let` declarators taint a name; a later assignment
 *   (`let n; n = config.x`) does not.
 * - Tainted names are tracked per file, not per function, so an unrelated
 *   function reusing a tainted name can report a false positive.
 *
 * Prefer `builder.observe(...)` for any config-derived value that is emitted
 * more than one emission after it is computed; that is the construct the rule
 * exists to steer templates toward.
 */

const BUILDER_FACTORIES = new Set(['createLineBuilder', 'createPatchBuilder']);
const BUILDER_TYPES = new Set(['LineBuilder', 'LineSink', 'PatchBuilder', 'PatchSink']);
const SCOPE_TYPES = new Set(['ProvenanceScope']);
const EMIT_METHODS = new Set([
  'line',
  'lines',
  'block',
  'replaceExact',
  'insertBeforeExact',
  'insertAfterExact',
]);
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** The head identifier of a parameter's type annotation, or `null`. */
function annotationHead(param) {
  const holder = param && param.typeAnnotation;
  const annotation = holder && holder.typeAnnotation;
  if (!annotation || annotation.type !== 'TSTypeReference') return null;
  const name = annotation.typeName;
  if (!name) return null;
  if (name.type === 'Identifier') return name.name;
  // A qualified name (`ns.LineSink`) is identified by its last segment.
  return name.right && name.right.name ? name.right.name : null;
}

/** Every identifier a binding pattern introduces. */
function boundNames(pattern, out) {
  if (!pattern) return out;
  switch (pattern.type) {
    case 'Identifier':
      out.push(pattern);
      break;
    case 'ObjectPattern':
      pattern.properties.forEach((property) => {
        boundNames(property.type === 'RestElement' ? property.argument : property.value, out);
      });
      break;
    case 'ArrayPattern':
      pattern.elements.forEach((element) => boundNames(element, out));
      break;
    case 'AssignmentPattern':
      boundNames(pattern.left, out);
      break;
    case 'RestElement':
      boundNames(pattern.argument, out);
      break;
    default:
      break;
  }
  return out;
}

/** `true` when this identifier stands for a value rather than a name in some other position. */
function isValueReference(node, parent) {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
    return false;
  }
  if (parent.type === 'Property' && parent.key === node && !parent.computed) return false;
  if (parent.type === 'VariableDeclarator' && parent.id === node) return false;
  if (typeof parent.type === 'string' && parent.type.startsWith('TS')) return false;
  if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier') return false;
  if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement') return false;
  return true;
}

/** A call of `<object>.<method>(...)`, or `null`. */
function memberCall(node) {
  if (!node || node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression' || callee.computed) return null;
  if (!callee.object || callee.object.type !== 'Identifier') return null;
  if (!callee.property || callee.property.type !== 'Identifier') return null;
  return { object: callee.object.name, method: callee.property.name };
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require config-derived values that cross an emission boundary to travel through builder.observe(...)',
    },
    schema: [
      {
        type: 'object',
        properties: {
          configTypes: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      earlyRead:
        '"{{name}}" is derived from config at line {{declaredLine}} and used after an intervening emission at line {{emitLine}}; the read will be attributed to the wrong line. Compute it with {{builder}}.observe(...) and pass .paths to the emitting call.',
      observedValueWithoutPaths:
        '"{{name}}.value" shapes this emission but "{{name}}.paths" is not passed to it; the lines it produces would carry none of the config paths it was computed from.',
      configReadBeforeBuilder:
        'Config is read here, before the builder declared on line {{builderLine}} exists; these reads are attributed to whatever that builder emits first. Move the read below the builder, or into its observe(...).',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const visitorKeys = sourceCode.visitorKeys || {};
    const options = context.options[0] || {};
    const configTypes = new Set(options.configTypes || []);

    const builderNames = new Set();
    const scopeNames = new Set();
    const configParamNames = new Set();

    const declarators = [];
    const callCandidates = [];
    const memberCandidates = [];
    const delegateCandidates = [];
    const identifiers = [];
    const builderDeclarations = [];

    const childrenOf = (node) =>
      visitorKeys[node.type] || Object.keys(node).filter((key) => key !== 'parent');

    function collect(node, parent, enclosing) {
      if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
      const scopeOwner = FUNCTION_TYPES.has(node.type) ? node : enclosing;

      if (FUNCTION_TYPES.has(node.type)) {
        (node.params || []).forEach((param) => {
          const target = param.type === 'AssignmentPattern' ? param.left : param;
          if (!target || target.type !== 'Identifier') return;
          const head = annotationHead(target);
          if (head === null) return;
          if (BUILDER_TYPES.has(head)) builderNames.add(target.name);
          else if (SCOPE_TYPES.has(head)) scopeNames.add(target.name);
          else if (configTypes.has(head)) configParamNames.add(target.name);
        });
      }

      if (node.type === 'VariableDeclarator') {
        declarators.push({ node, fn: scopeOwner });
        const init = node.init;
        if (
          init &&
          init.type === 'CallExpression' &&
          init.callee &&
          init.callee.type === 'Identifier' &&
          BUILDER_FACTORIES.has(init.callee.name)
        ) {
          builderDeclarations.push({ node, fn: scopeOwner });
          if (node.id && node.id.type === 'Identifier') builderNames.add(node.id.name);
        }
      }

      if (node.type === 'CallExpression') {
        const call = memberCall(node);
        if (call !== null) callCandidates.push({ node, fn: scopeOwner, ...call });
        else if (node.callee && node.callee.type === 'Identifier') {
          // A helper handed the builder emits through it. Which builder names
          // exist is not known until collection finishes, so record the shape
          // now and decide in `Program:exit`.
          const passed = (node.arguments || [])
            .filter((argument) => argument && argument.type === 'Identifier')
            .map((argument) => argument.name);
          if (passed.length > 0 && !BUILDER_FACTORIES.has(node.callee.name)) {
            delegateCandidates.push({ node, fn: scopeOwner, callee: node.callee.name, passed });
          }
        }
      }

      if (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.property &&
        node.property.type === 'Identifier' &&
        node.property.name === 'config' &&
        node.object &&
        node.object.type === 'Identifier'
      ) {
        memberCandidates.push({ node, owner: node.object.name });
      }

      if (node.type === 'Identifier') identifiers.push({ node, parent, fn: scopeOwner });

      for (const key of childrenOf(node)) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach((entry) => collect(entry, node, scopeOwner));
        else collect(child, node, scopeOwner);
      }
    }

    /**
     * `true` for a `<builder>.observe(...)` call. Whatever such a call reads is
     * recorded against the value it returns, and the returned `Observed` carries
     * its own paths — so a binding is not config-derived merely because an
     * observe callback nested inside its initialiser touches config.
     */
    function isObserveCall(node) {
      const call = memberCall(node);
      return call !== null && builderNames.has(call.object) && call.method === 'observe';
    }

    /** `subtree`, without descending into the observe calls `prune` selects. */
    function subtreeExcept(root, prune, visit) {
      const stack = [{ node: root, parent: null }];
      while (stack.length > 0) {
        const { node, parent } = stack.pop();
        if (!node || typeof node !== 'object' || typeof node.type !== 'string') continue;
        if (prune(node)) continue;
        visit(node, parent);
        for (const key of childrenOf(node)) {
          const child = node[key];
          if (Array.isArray(child))
            child.forEach((entry) => stack.push({ node: entry, parent: node }));
          else stack.push({ node: child, parent: node });
        }
      }
    }

    /** Every node of `root`'s subtree, with its parent. */
    function subtree(root, visit) {
      const stack = [{ node: root, parent: null }];
      while (stack.length > 0) {
        const { node, parent } = stack.pop();
        if (!node || typeof node !== 'object' || typeof node.type !== 'string') continue;
        visit(node, parent);
        for (const key of childrenOf(node)) {
          const child = node[key];
          if (Array.isArray(child))
            child.forEach((entry) => stack.push({ node: entry, parent: node }));
          else stack.push({ node: child, parent: node });
        }
      }
    }

    const isConfigSource = (node) =>
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.property &&
      node.property.name === 'config' &&
      node.object &&
      node.object.type === 'Identifier' &&
      (builderNames.has(node.object.name) || scopeNames.has(node.object.name));

    const withinFunction = (node, fn) =>
      fn && node.range[0] >= fn.range[0] && node.range[1] <= fn.range[1];

    return {
      'Program:exit'(program) {
        collect(program, null, program);

        // An emission is either a builder's own emit method, or a call that hands
        // the builder to a helper: the helper emits through it, so the boundary
        // is at the call site even though no emit method is named here. Without
        // the second kind, a template that delegates every edit to helpers — the
        // shape every patch-based contract template has — presents no boundary
        // at all, and a value hoisted above the delegation goes unreported.
        const emits = [
          ...callCandidates.filter(
            (call) => builderNames.has(call.object) && EMIT_METHODS.has(call.method)
          ),
          ...delegateCandidates
            .filter((call) => call.passed.some((name) => builderNames.has(name)))
            .map((call) => ({
              node: call.node,
              fn: call.fn,
              object: call.passed.find((name) => builderNames.has(name)),
              method: call.callee,
            })),
        ];

        // `observe(...)` is the sole way to hold a config-derived value across an
        // emission, so its bindings are exempt from taint and get their own check.
        const observedNames = new Set();
        declarators.forEach(({ node }) => {
          const call = memberCall(node.init);
          if (call !== null && builderNames.has(call.object) && call.method === 'observe') {
            boundNames(node.id, []).forEach((identifier) => observedNames.add(identifier.name));
          }
        });

        const taintedNames = new Set();
        const tainted = [];
        [...declarators]
          .sort((a, b) => a.node.range[0] - b.node.range[0])
          .forEach(({ node, fn }) => {
            if (!node.init) return; // a loop-head binding is a live view, not a hoist
            const call = memberCall(node.init);
            if (call !== null && builderNames.has(call.object) && call.method === 'observe') return;

            let derived = false;
            subtreeExcept(node.init, isObserveCall, (child, parent) => {
              if (derived) return;
              if (isConfigSource(child)) {
                derived = true;
                return;
              }
              if (child.type !== 'Identifier' || !isValueReference(child, parent)) return;
              if (configParamNames.has(child.name) || taintedNames.has(child.name)) derived = true;
            });
            if (!derived) return;

            boundNames(node.id, []).forEach((identifier) => {
              taintedNames.add(identifier.name);
              tainted.push({ identifier, declarator: node, fn });
            });
          });

        // 1. A tainted binding used after an intervening emission.
        tainted.forEach(({ identifier, declarator, fn }) => {
          const declaredEnd = declarator.range[1];
          const localEmits = emits
            .filter((emit) => emit.fn === fn && emit.node.range[0] >= declaredEnd)
            .sort((a, b) => a.node.range[0] - b.node.range[0]);
          if (localEmits.length === 0) return;

          const references = identifiers
            .filter(
              (entry) =>
                entry.node !== identifier &&
                entry.node.name === identifier.name &&
                entry.node.range[0] >= declaredEnd &&
                isValueReference(entry.node, entry.parent) &&
                withinFunction(entry.node, fn)
            )
            .sort((a, b) => a.node.range[0] - b.node.range[0]);

          for (const reference of references) {
            // The emission must have finished before the use: a reference inside
            // the emitting call's own arguments is not a boundary crossing.
            const intervening = localEmits.find(
              (emit) => emit.node.range[1] <= reference.node.range[0]
            );
            if (intervening === undefined) continue;
            context.report({
              node: identifier,
              messageId: 'earlyRead',
              data: {
                name: identifier.name,
                declaredLine: String(identifier.loc.start.line),
                emitLine: String(intervening.node.loc.start.line),
                builder: intervening.object,
              },
            });
            return;
          }
        });

        // 2. An observed value shaping an emission that does not carry its paths.
        emits.forEach((emit) => {
          const used = new Set();
          const carried = new Set();
          (emit.node.arguments || []).forEach((argument) => {
            subtree(argument, (child) => {
              if (
                child.type !== 'MemberExpression' ||
                child.computed ||
                !child.object ||
                child.object.type !== 'Identifier' ||
                !observedNames.has(child.object.name) ||
                !child.property
              ) {
                return;
              }
              if (child.property.name === 'value') used.add(child.object.name);
              if (child.property.name === 'paths') carried.add(child.object.name);
            });
          });
          [...used]
            .sort()
            .filter((name) => !carried.has(name))
            .forEach((name) => {
              context.report({
                node: emit.node,
                messageId: 'observedValueWithoutPaths',
                data: { name },
              });
            });
        });

        // 3. Config read above the builder that is supposed to see it.
        const firstBuilderPerFunction = new Map();
        builderDeclarations.forEach(({ node, fn }) => {
          const current = firstBuilderPerFunction.get(fn);
          if (current === undefined || node.range[0] < current.range[0]) {
            firstBuilderPerFunction.set(fn, node);
          }
        });
        firstBuilderPerFunction.forEach((builderNode, fn) => {
          const reports = [];
          memberCandidates.forEach(({ node, owner }) => {
            if (!scopeNames.has(owner) && !builderNames.has(owner)) return;
            if (!withinFunction(node, fn) || node.range[0] >= builderNode.range[0]) return;
            reports.push(node);
          });
          identifiers.forEach((entry) => {
            if (!configParamNames.has(entry.node.name)) return;
            if (!isValueReference(entry.node, entry.parent)) return;
            if (!withinFunction(entry.node, fn) || entry.node.range[0] >= builderNode.range[0]) {
              return;
            }
            reports.push(entry.node);
          });
          reports
            .sort((a, b) => a.range[0] - b.range[0])
            .forEach((node) => {
              context.report({
                node,
                messageId: 'configReadBeforeBuilder',
                data: { builderLine: String(builderNode.loc.start.line) },
              });
            });
        });
      },
    };
  },
};
