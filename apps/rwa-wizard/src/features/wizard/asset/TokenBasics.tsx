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
            helperText="10/32 characters"
            control={control}
            validation={{ required: true, maxLength: 32 }}
          />
          <TextField
            id="token-symbol"
            name="symbol"
            label="Token Symbol"
            placeholder="RWA"
            helperText="3/12 characters"
            control={control}
            validation={{ required: true, maxLength: 12 }}
          />
          <NumberField
            id="token-decimals"
            name="decimals"
            label="Decimals"
            control={control}
            helperText="Typically 7 for Stellar/Soroban tokens"
            validation={{ required: true, min: 0, max: 18 }}
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
