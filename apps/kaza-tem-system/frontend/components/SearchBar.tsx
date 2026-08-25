'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  ClickAwayListener,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Search } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import productService from '@/services/productService';

const SearchWrapper = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  background: '#fff',
  borderRadius: 999,
  padding: theme.spacing(0.5, 1),
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
}));

const SearchInput = styled(InputBase)(({ theme }) => ({
  flex: 1,
  marginLeft: theme.spacing(1),
}));

const HISTORY_KEY = 'kazaTemSearchHistory';
const MAX_HISTORY = 5;

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const products = await productService.getAll({
          q: query.trim(),
          limit: 4,
        });
        setSuggestions(products.map((product) => product.name));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const persistHistory = (term: string) => {
    if (!term.trim() || typeof window === 'undefined') {
      return;
    }
    const next = [term, ...history.filter((item) => item !== term)].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  };

  const handleSearch = (value?: string) => {
    const term = (value ?? query).trim();
    if (!term) return;
    persistHistory(term);
    setOpen(false);
    router.push(`/products?q=${encodeURIComponent(term)}`);
  };

  const handleSuggestionClick = (value: string) => {
    setQuery(value);
    handleSearch(value);
  };

  const handleFocus = () => {
    setOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const hasHistory = history.length > 0;
  const showList = open && (suggestions.length > 0 || hasHistory);

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <SearchWrapper>
          <SearchInput
            placeholder="Buscar produtos, categorias ou marcas"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
          />
          <IconButton color="primary" onClick={() => handleSearch()}>
            <Search />
          </IconButton>
        </SearchWrapper>
        {showList ? (
          <Paper
            elevation={6}
            sx={{
              position: 'absolute',
              width: '100%',
              mt: 1,
              zIndex: 10,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {query.trim() ? (
              suggestions.length > 0 ? (
                <List disablePadding>
                  {suggestions.map((item) => (
                    <ListItemButton key={item} onClick={() => handleSuggestionClick(item)}>
                      <ListItemText primary={item} />
                    </ListItemButton>
                  ))}
                </List>
              ) : (
                <Box sx={{ p: 2 }}>
                  {loading ? (
                    <Typography variant="body2" color="text.secondary">
                      Buscando sugestões...
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Nenhum resultado rápido encontrado.
                    </Typography>
                  )}
                </Box>
              )
            ) : hasHistory ? (
              <List disablePadding>
                <Typography variant="subtitle2" sx={{ px: 2, pt: 1 }}>
                  Histórico
                </Typography>
                {history.map((term) => (
                  <ListItemButton key={term} onClick={() => handleSuggestionClick(term)}>
                    <ListItemText primary={term} />
                  </ListItemButton>
                ))}
              </List>
            ) : null}
          </Paper>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
}
