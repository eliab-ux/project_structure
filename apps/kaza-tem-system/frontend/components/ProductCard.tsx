'use client';

import { Card, CardContent, CardMedia, Typography, Box, Chip, Button } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(() => ({
  transition: 'all 0.3s ease',
  borderRadius: 8,
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
  '&:hover': {
    transform: 'translateY(-6px)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
  },
}));

const Badge = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  left: theme.spacing(1),
  backgroundColor: '#FF6900',
  color: '#fff',
  fontWeight: 700,
}));

export interface ProductCardProps {
  name: string;
  price: string;
  oldPrice?: string;
  image: string;
  badge?: string;
}

export function ProductCard(props: ProductCardProps) {
  return (
    <StyledCard>
      {props.badge ? <Badge label={props.badge} size="small" /> : null}
      <CardMedia component="img" height="200" image={props.image} alt={props.name} />
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700}>
          {props.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 1 }}>
          <Typography variant="h6" color="text.primary">
            R$ {props.price}
          </Typography>
          {props.oldPrice ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: 'line-through' }}
            >
              R$ {props.oldPrice}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" color="primary" fullWidth>
            Comprar
          </Button>
        </Box>
      </CardContent>
    </StyledCard>
  );
}
