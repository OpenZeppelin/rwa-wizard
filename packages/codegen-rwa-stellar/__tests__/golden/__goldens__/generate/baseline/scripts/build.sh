#!/bin/bash
set -e

echo "Building all workspace contracts..."
stellar contract build

echo "Build complete."
