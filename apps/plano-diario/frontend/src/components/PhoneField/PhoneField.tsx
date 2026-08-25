'use client';

import { InputBaseComponentProps } from '@mui/material/InputBase';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import { ElementType, forwardRef } from 'react';
import { IMaskInput } from 'react-imask';

interface MaskProps {
  name: string;
  /** O `onChange` do react-hook-form aceita este formato de evento sintético. */
  onChange: (event: { target: { name: string; value: string } }) => void;
}

/**
 * A máscara em si. `onAccept` dispara com o valor já mascarado, que é o que o formulário guarda —
 * o backend normaliza para E.164, então mandar `(11) 91234-5678` é seguro.
 */
const PhoneMaskInput = forwardRef<HTMLInputElement, MaskProps>(function PhoneMaskInput(
  { onChange, name, ...other },
  ref,
) {
  return (
    <IMaskInput
      {...other}
      // Celular brasileiro: DDD + 9 dígitos. É o número que recebe WhatsApp.
      mask="(00) 00000-0000"
      inputRef={ref}
      onAccept={(value: string) => onChange({ target: { name, value } })}
      overwrite
    />
  );
});

/**
 * Campo de WhatsApp com máscara. Existe como componente porque aparece em dois lugares (cadastro
 * e configuração da conta) e a máscara precisa ser a mesma nos dois.
 */
export function PhoneField(props: TextFieldProps) {
  return (
    <TextField
      type="tel"
      autoComplete="tel"
      placeholder="(11) 91234-5678"
      {...props}
      InputProps={{
        ...props.InputProps,
        // O MUI tipa `inputComponent` como ElementType<InputBaseComponentProps>; o componente de
        // máscara tem props mais estreitas, daí a conversão — não é `any` solto.
        inputComponent: PhoneMaskInput as unknown as ElementType<InputBaseComponentProps>,
      }}
    />
  );
}
