'use client';

import { Stepper, Step, StepLabel, Box } from '@mui/material';

const STEPS = ['Endereço', 'Pagamento', 'Revisão'];

export function CheckoutStepper({ activeStep }: { activeStep: number }) {
  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
