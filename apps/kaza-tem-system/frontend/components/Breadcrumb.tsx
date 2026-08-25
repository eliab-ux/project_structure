'use client';

import { Breadcrumbs, Typography, Link as MuiLink } from '@mui/material';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <Breadcrumbs aria-label="breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast || !item.href) {
          return (
            <Typography key={item.label} color="text.primary">
              {item.label}
            </Typography>
          );
        }
        return (
          <MuiLink key={item.label} href={item.href} underline="hover" color="text.secondary">
            {item.label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
}
