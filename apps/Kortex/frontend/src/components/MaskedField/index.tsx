'use client';

import { forwardRef } from 'react';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import { IMaskInput } from 'react-imask';

/**
 * Campo com máscara — CNPJ, CPF, telefone, CEP.
 *
 * A máscara não é enfeite: ela **limita o número de dígitos**. Sem ela, o operador digita um CNPJ
 * com 13 ou 15 números, o `class-validator` recusa no envio e ele volta para conferir 14 dígitos
 * grudados na tela. Com a máscara o erro não chega a existir.
 *
 * O valor sai daqui **formatado** (`11.222.333/0001-81`) porque é o que a pessoa lê e confere. Quem
 * tira a pontuação é o backend, que guarda só dígitos — se a coluna guardasse a máscara, o índice
 * único `(account_id, document)` deixaria o mesmo CNPJ entrar de novo digitado sem pontos.
 */

interface MaskAdapterProps {
  mask: string;
  name: string;
  onChange: (event: { target: { name: string; value: string } }) => void;
}

/**
 * O `inputComponent` que o MUI espera.
 *
 * O `IMaskInput` não dispara `onChange` no formato de evento do React, então o adapter traduz —
 * é isso que faz o campo funcionar com `useState` e com react-hook-form sem gambiarra.
 */
const MaskAdapter = forwardRef<HTMLInputElement, MaskAdapterProps>(function MaskAdapter(
  { onChange, name, ...other },
  ref,
) {
  return (
    <IMaskInput
      {...other}
      inputRef={ref}
      onAccept={(value: string) => onChange({ target: { name, value } })}
      overwrite
    />
  );
});

type MaskedFieldProps = Omit<TextFieldProps, 'onChange'> & {
  mask: string;
  onChange: (value: string) => void;
};

export function MaskedField({ mask, onChange, value, ...props }: MaskedFieldProps) {
  return (
    <TextField
      {...props}
      value={value ?? ''}
      InputProps={{
        ...props.InputProps,
        inputComponent: MaskAdapter as never,
        // `key={mask}`: trocar de CNPJ para CPF muda a máscara, e sem remontar o input o IMask
        // continuaria aplicando a antiga sobre o texto novo.
        inputProps: { mask, key: mask },
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** As máscaras usadas no sistema, num lugar só. */
export const MASKS = {
  cnpj: '00.000.000/0000-00',
  cpf: '000.000.000-00',
  /** Celular com DDD. O WhatsApp do Brasil tem 9 no começo do número. */
  phone: '(00) 0 0000-0000',
  zipCode: '00000-000',
} as const;
