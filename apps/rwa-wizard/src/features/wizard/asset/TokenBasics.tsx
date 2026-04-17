import type { Control } from 'react-hook-form';

import type { TokenConfig } from '@openzeppelin/rwa-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NumberField,
  TextField,
} from '@openzeppelin/ui-components';

import {
  TOKEN_DECIMALS_MAX,
  TOKEN_DECIMALS_MIN,
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SYMBOL_MAX_LENGTH,
} from '../validation/stepConstraints';

interface TokenBasicsProps {
  control: Control<TokenConfig>;
}

export function TokenBasics({ control }: TokenBasicsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Information</CardTitle>
        <CardDescription>Define the basic properties of your token.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="token-name"
            name="name"
            label="Token Name"
            placeholder="MyRWAToken"
            helperText={`Up to ${TOKEN_NAME_MAX_LENGTH} characters`}
            control={control}
            validation={{ required: true, maxLength: TOKEN_NAME_MAX_LENGTH }}
          />
          <TextField
            id="token-symbol"
            name="symbol"
            label="Token Symbol"
            placeholder="RWA"
            helperText={`Up to ${TOKEN_SYMBOL_MAX_LENGTH} characters`}
            control={control}
            validation={{ required: true, maxLength: TOKEN_SYMBOL_MAX_LENGTH }}
          />
          <NumberField
            id="token-decimals"
            name="decimals"
            label="Decimals"
            control={control}
            helperText="Typically 7 for Stellar/Soroban tokens"
            validation={{ required: true, min: TOKEN_DECIMALS_MIN, max: TOKEN_DECIMALS_MAX }}
          />
          <TextField
            id="token-initial-supply"
            name="initialSupply"
            label="Initial Supply (Optional)"
            placeholder="0"
            helperText="Leave empty if no initial supply"
            control={control}
          />
        </div>
      </CardContent>
    </Card>
  );
}
