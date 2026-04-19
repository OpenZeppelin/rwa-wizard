import type { Control } from 'react-hook-form';

import type { TokenConfig } from '@openzeppelin/rwa-config';
import { formatCopy } from '@openzeppelin/rwa-wizard-copy';
import { Card, CardContent, NumberField, TextField } from '@openzeppelin/ui-components';

import { useCopy } from '../../../../app/providers/useCopy';
import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import {
  TOKEN_DECIMALS_MAX,
  TOKEN_DECIMALS_MIN,
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SYMBOL_MAX_LENGTH,
} from '../../validation/stepConstraints';

interface TokenBasicsProps {
  control: Control<TokenConfig>;
}

export function TokenBasics({ control }: TokenBasicsProps) {
  const sectionCopy = useSectionCopy('token-information');
  const fieldHelper = useCopy().fieldHelper;

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="token-name"
            name="name"
            label="Token Name"
            placeholder="My Real Estate Token"
            helperText={formatCopy(fieldHelper('token.name').description, {
              maxLength: TOKEN_NAME_MAX_LENGTH,
            })}
            control={control}
            validation={{ required: true, maxLength: TOKEN_NAME_MAX_LENGTH }}
          />
          <TextField
            id="token-symbol"
            name="symbol"
            label="Token Symbol"
            placeholder="MRET"
            helperText={formatCopy(fieldHelper('token.symbol').description, {
              maxLength: TOKEN_SYMBOL_MAX_LENGTH,
            })}
            control={control}
            validation={{ required: true, maxLength: TOKEN_SYMBOL_MAX_LENGTH }}
          />
          <NumberField
            id="token-decimals"
            name="decimals"
            label="Decimals"
            control={control}
            helperText={fieldHelper('token.decimals').description}
            validation={{ required: true, min: TOKEN_DECIMALS_MIN, max: TOKEN_DECIMALS_MAX }}
          />
          <TextField
            id="token-initial-supply"
            name="initialSupply"
            label="Initial Supply (Optional)"
            placeholder="0"
            helperText={fieldHelper('token.initial-supply').description}
            control={control}
          />
        </div>
      </CardContent>
    </Card>
  );
}
