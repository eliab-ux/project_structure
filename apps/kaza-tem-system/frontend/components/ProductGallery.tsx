'use client';

import { Box, Stack } from '@mui/material';
import { useMemo, useState } from 'react';

type ProductGalleryProps = {
  images: string[];
};

export function ProductGallery({ images }: ProductGalleryProps) {
  const fallbackImages = useMemo(
    () => [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80',
    ],
    [],
  );
  const galleryImages = images.length > 0 ? images : fallbackImages;
  const [selectedImage, setSelectedImage] = useState(galleryImages[0]);

  return (
    <Stack spacing={2}>
      <Box
        component="img"
        src={selectedImage}
        alt="Imagem do produto"
        sx={{ width: '100%', borderRadius: 2, objectFit: 'cover', maxHeight: 420 }}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {galleryImages.map((image) => (
          <Box
            key={image}
            component="img"
            src={image}
            alt="Miniatura do produto"
            onClick={() => setSelectedImage(image)}
            sx={{
              width: 80,
              height: 80,
              borderRadius: 1,
              objectFit: 'cover',
              cursor: 'pointer',
              border: selectedImage === image ? '2px solid' : '1px solid',
              borderColor: selectedImage === image ? 'primary.main' : 'divider',
            }}
          />
        ))}
      </Stack>
    </Stack>
  );
}
