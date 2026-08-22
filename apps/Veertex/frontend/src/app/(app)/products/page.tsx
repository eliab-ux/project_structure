'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import productService from 'src/services/productService';
import contactService from 'src/services/contactService';
import { Contact } from 'src/types/admin';
import {
  Product,
  ProductCatalog,
  ProductFieldDefinition,
  ProductPurposeStatus,
} from 'src/types/product';

const ADMIN_MAX_WIDTH = 1200;

/** O formulário é plano, como a API. Números ficam como texto até o envio — ver `numero()`. */
interface FormState {
  name: string;
  sku: string;
  kind: string;
  unit: string;
  basePrice: string;
  brand: string;
  categoryPath: string;
  barcode: string;
  shortDescription: string;
  grossWeightKg: string;
  netWeightKg: string;
  widthCm: string;
  heightCm: string;
  lengthCm: string;
  minimumQuantity: string;
  maximumQuantity: string;
  location: string;
  origin: string;
  ncm: string;
  cest: string;
  taxGroup: string;
}

interface LinhaFornecedor {
  contactId: string;
  supplierSku: string;
  cost: string;
  isDefault: boolean;
}

const FORM_VAZIO: FormState = {
  name: '',
  sku: '',
  kind: 'product',
  unit: 'UN',
  basePrice: '',
  brand: '',
  categoryPath: '',
  barcode: '',
  shortDescription: '',
  grossWeightKg: '',
  netWeightKg: '',
  widthCm: '',
  heightCm: '',
  lengthCm: '',
  minimumQuantity: '',
  maximumQuantity: '',
  location: '',
  origin: '',
  ncm: '',
  cest: '',
  taxGroup: '',
};

/**
 * Texto → número, aceitando a vírgula decimal do português.
 *
 * `Number("12,50")` é `NaN`, e um NaN silencioso viraria `null` no payload: o produto seria salvo
 * sem preço e ninguém veria o problema até tentar vendê-lo. Vazio é `undefined` ("não mexa"), não
 * zero.
 */
function numero(valor: string): number | undefined {
  const limpo = valor.trim();
  if (!limpo) {
    return undefined;
  }
  const convertido = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(convertido) ? convertido : undefined;
}

function texto(valor: string): string | undefined {
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}

/**
 * PRODUTOS — §3.5 do CORE.
 *
 * ## O que a tela NÃO oferece, e cada ausência acompanha o backend
 *
 * | | Por quê |
 * |---|---|
 * | montar KIT | o formato `bundle` ficou fora por inteiro até o módulo de Estoque existir. `creatableFormats` vem do servidor justamente para a tela não oferecer o que a API recusa |
 * | variações | idem, até o módulo de Catálogo |
 * | imagens | MinIO não existe no ambiente |
 * | saldo em estoque | é do EST. A tela mostra os PARÂMETROS (mínimo, máximo, localização), e o `hint` do catálogo diz que o saldo depende do módulo |
 * | CFOP | §3.5, explícito |
 *
 * ## O widget de completude é requisito, não enfeite (§3.5)
 *
 * Ele diz **para o que o cadastro serve hoje**, e a redação vem do servidor: *"Campos fiscais
 * preenchidos"*, nunca *"pronto para emissão fiscal"*. A diferença não é estilo — a primeira fala do
 * cadastro, a segunda afirmaria que o sistema emite nota, o que é falso sem o módulo Fiscal. Quando o
 * módulo é ativado, o aviso desaparece sozinho.
 */
export default function ProductsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { can } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<ProductCatalog | null>(null);
  const [fornecedores, setFornecedores] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [avancados, setAvancados] = useState(false);
  /**
   * As linhas de fornecedor do formulário.
   *
   * A lista é enviada INTEIRA a cada gravação (o backend substitui), então ela não carrega id de
   * linha: o que a tela mostra é o que passa a existir. É a mesma semântica das coleções do contato.
   */
  const [linhasFornecedor, setLinhasFornecedor] = useState<LinhaFornecedor[]>([]);
  const [salvando, setSalvando] = useState(false);

  const podeCriar = can('products.create');
  const podeEditar = can('products.update');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [lista, cat] = await Promise.all([
        productService.list({
          search: search.trim() || undefined,
          kind: kind || undefined,
          includeInactive,
        }),
        // O catálogo é buscado junto: sem ele a tela não sabe quais campos exibir nem quais
        // unidades a API aceita, e adivinhar é como se oferece opção que o servidor recusa.
        catalog ? Promise.resolve(catalog) : productService.catalog(),
      ]);
      setProducts(lista);
      setCatalog(cat);
    } catch (error) {
      setErro(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [search, kind, includeInactive, catalog]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Só contatos com o tipo FORNECEDOR entram na lista.
   *
   * O backend recusa o vínculo com quem não é fornecedor; filtrar aqui é o que evita o operador
   * escolher um cliente e descobrir no salvamento. As duas camadas, como sempre — a da tela por
   * conveniência, a do servidor por garantia.
   */
  const carregarFornecedores = useCallback(async () => {
    try {
      setFornecedores(await contactService.list({ type: 'supplier' }));
    } catch {
      // Falhar aqui não impede cadastrar produto: o bloco de fornecedores fica vazio, e o resto do
      // formulário continua utilizável.
      setFornecedores([]);
    }
  }, []);

  const camposVisiveis = useMemo(() => {
    const mapa = new Map<string, ProductFieldDefinition>();
    for (const campo of catalog?.fields ?? []) {
      mapa.set(campo.field, campo);
    }
    return mapa;
  }, [catalog]);

  /** O catálogo decide o default; o interruptor "campos avançados" revela o resto sob demanda. */
  const mostrar = useCallback(
    (field: keyof FormState) => {
      const campo = camposVisiveis.get(field);
      if (!campo) {
        return false;
      }
      return campo.visible || avancados;
    },
    [camposVisiveis, avancados],
  );

  const hint = useCallback(
    (field: keyof FormState) => camposVisiveis.get(field)?.hint,
    [camposVisiveis],
  );

  const label = useCallback(
    (field: keyof FormState, fallback: string) => camposVisiveis.get(field)?.label ?? fallback,
    [camposVisiveis],
  );

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setLinhasFornecedor([]);
    setAvancados(false);
    setAberto(true);
    void carregarFornecedores();
  }

  function abrirEdicao(product: Product) {
    setEditando(product);
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      kind: product.kind,
      unit: product.unit,
      basePrice: product.basePrice === null ? '' : String(product.basePrice),
      brand: product.brand ?? '',
      categoryPath: product.categoryPath ?? '',
      barcode: product.barcode ?? '',
      shortDescription: product.shortDescription ?? '',
      grossWeightKg: product.grossWeightKg === null ? '' : String(product.grossWeightKg),
      netWeightKg: product.netWeightKg === null ? '' : String(product.netWeightKg),
      widthCm: product.widthCm === null ? '' : String(product.widthCm),
      heightCm: product.heightCm === null ? '' : String(product.heightCm),
      lengthCm: product.lengthCm === null ? '' : String(product.lengthCm),
      minimumQuantity: product.minimumQuantity === null ? '' : String(product.minimumQuantity),
      maximumQuantity: product.maximumQuantity === null ? '' : String(product.maximumQuantity),
      location: product.location ?? '',
      origin: product.origin ?? '',
      ncm: product.ncm ?? '',
      cest: product.cest ?? '',
      taxGroup: product.taxGroup ?? '',
    });
    setLinhasFornecedor(
      product.suppliers.map((entry) => ({
        contactId: entry.contactId,
        supplierSku: entry.supplierSku ?? '',
        cost: entry.cost === null ? '' : String(entry.cost),
        isDefault: entry.isDefault,
      })),
    );
    // Na edição os avançados abrem se o produto JÁ tem dado neles: esconder um NCM preenchido faria
    // o operador achar que ele foi perdido.
    setAvancados(Boolean(product.ncm || product.cest || product.origin || product.taxGroup));
    setAberto(true);
    void carregarFornecedores();
  }

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        sku: texto(form.sku) ?? null,
        kind: form.kind,
        basePrice: numero(form.basePrice) ?? null,
        brand: texto(form.brand) ?? null,
        categoryPath: texto(form.categoryPath) ?? null,
        barcode: texto(form.barcode) ?? null,
        shortDescription: texto(form.shortDescription) ?? null,
        grossWeightKg: numero(form.grossWeightKg) ?? null,
        netWeightKg: numero(form.netWeightKg) ?? null,
        widthCm: numero(form.widthCm) ?? null,
        heightCm: numero(form.heightCm) ?? null,
        lengthCm: numero(form.lengthCm) ?? null,
        minimumQuantity: numero(form.minimumQuantity) ?? null,
        maximumQuantity: numero(form.maximumQuantity) ?? null,
        location: texto(form.location) ?? null,
        origin: texto(form.origin) ?? null,
        ncm: texto(form.ncm) ?? null,
        cest: texto(form.cest) ?? null,
        taxGroup: texto(form.taxGroup) ?? null,
        // Linha sem fornecedor escolhido é descartada: ela é uma linha que o operador abriu e não
        // preencheu, e enviá-la faria o servidor recusar o produto inteiro por causa de um vazio.
        suppliers: linhasFornecedor
          .filter((linha) => linha.contactId)
          .map((linha) => ({
            contactId: linha.contactId,
            supplierSku: texto(linha.supplierSku) ?? null,
            cost: numero(linha.cost) ?? null,
            isDefault: linha.isDefault,
          })),
      };

      const salvo = editando
        ? await productService.update(editando.id, payload)
        : await productService.create(payload);

      enqueueSnackbar(
        editando ? `Produto "${salvo.name}" atualizado.` : `Produto "${salvo.name}" cadastrado.`,
        { variant: 'success' },
      );
      setAberto(false);
      await carregar();
    } catch (error) {
      // A mensagem vem do servidor porque é ele que explica: "kit depende do módulo de Estoque",
      // "unidade deve ser uma das siglas", "já existe produto com este SKU".
      enqueueSnackbar(apiErrorMessage(error), { variant: 'error' });
    } finally {
      setSalvando(false);
    }
  }

  async function alternarSituacao(product: Product) {
    try {
      await productService.update(product.id, { active: !product.active });
      enqueueSnackbar(product.active ? 'Produto desativado.' : 'Produto reativado.', {
        variant: 'success',
      });
      await carregar();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error), { variant: 'error' });
    }
  }

  const estado = (
    <DataState
      loading={loading}
      error={erro}
      empty={products.length === 0}
      emptyMessage={
        search || kind ? 'Nenhum produto para este filtro.' : 'Nenhum produto cadastrado.'
      }
    />
  );

  const campoTexto = (
    field: keyof FormState,
    fallback: string,
    extra: { multiline?: boolean; required?: boolean } = {},
  ) =>
    mostrar(field) ? (
      <TextField
        label={label(field, fallback)}
        value={form[field]}
        onChange={(event) => setForm((atual) => ({ ...atual, [field]: event.target.value }))}
        helperText={hint(field)}
        required={extra.required}
        multiline={extra.multiline}
        minRows={extra.multiline ? 2 : undefined}
        fullWidth
        size="small"
      />
    ) : null;

  return (
    <Box
      component="main"
      sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}
    >
      <PageHeader
        title="Produtos"
        description="Cadastro de produtos e serviços. Vender, estocar e emitir nota dependem dos módulos correspondentes."
        action={
          podeCriar ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNovo}>
              Novo produto
            </Button>
          ) : null
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            label="Buscar"
            placeholder="Nome, SKU, marca, categoria ou código de barras"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            fullWidth
          />
          <ToggleButtonGroup
            value={kind}
            exclusive
            size="small"
            onChange={(_, valor) => setKind(valor ?? '')}
            aria-label="Filtrar por tipo"
          >
            <ToggleButton value="">Todos</ToggleButton>
            {(catalog?.kinds ?? []).map((item) => (
              <ToggleButton key={item.code} value={item.code}>
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <FormControlLabel
            control={
              <Switch
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
            }
            label="Incluir inativos"
          />
        </Stack>
      </Paper>

      {estado}

      {!loading && !erro && products.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Produtos">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Unid.</TableCell>
                <TableCell align="right">Preço</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Cadastro</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{product.name}</Typography>
                      {!product.active ? <Chip label="Inativo" size="small" /> : null}
                      {product.kind === 'service' ? <Chip label="Serviço" size="small" /> : null}
                    </Stack>
                    {product.brand ? (
                      <Typography variant="caption" color="text.secondary">
                        {product.brand}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{product.sku ?? '—'}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell align="right">
                    {product.basePrice === null
                      ? '—'
                      : product.basePrice.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                  </TableCell>
                  <TableCell>{product.categoryPath ?? '—'}</TableCell>
                  <TableCell>
                    <CompletudeResumo purposes={product.purposes} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {podeEditar ? (
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => abrirEdicao(product)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {podeEditar ? (
                        <Button size="small" onClick={() => void alternarSituacao(product)}>
                          {product.active ? 'Desativar' : 'Reativar'}
                        </Button>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <Dialog open={aberto} onClose={() => setAberto(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editando ? `Editar ${editando.name}` : 'Novo produto'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <section aria-label="Identificação">
              <Typography variant="overline" color="text.secondary">
                Identificação
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {campoTexto('name', 'Nome', { required: true })}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {campoTexto('sku', 'SKU / Código')}
                  <TextField
                    select
                    label={label('unit', 'Unidade')}
                    value={form.unit}
                    onChange={(event) =>
                      setForm((atual) => ({ ...atual, unit: event.target.value }))
                    }
                    size="small"
                    fullWidth
                    required
                  >
                    {(catalog?.units ?? []).map((sigla) => (
                      <MenuItem key={sigla} value={sigla}>
                        {sigla}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={label('kind', 'Tipo')}
                    value={form.kind}
                    onChange={(event) =>
                      setForm((atual) => ({ ...atual, kind: event.target.value }))
                    }
                    size="small"
                    fullWidth
                  >
                    {(catalog?.kinds ?? []).map((item) => (
                      <MenuItem key={item.code} value={item.code}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {campoTexto('basePrice', 'Preço de venda')}
                  {campoTexto('brand', 'Marca')}
                </Stack>
                {campoTexto('categoryPath', 'Categoria')}
                {campoTexto('barcode', 'GTIN / EAN')}
                {campoTexto('shortDescription', 'Descrição curta', { multiline: true })}
              </Stack>
            </section>

            <Divider />

            <section aria-label="Medidas">
              <Typography variant="overline" color="text.secondary">
                Medidas — usadas na cotação de frete
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                {campoTexto('grossWeightKg', 'Peso bruto (kg)')}
                {campoTexto('netWeightKg', 'Peso líquido (kg)')}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                {campoTexto('widthCm', 'Largura (cm)')}
                {campoTexto('heightCm', 'Altura (cm)')}
                {campoTexto('lengthCm', 'Comprimento (cm)')}
              </Stack>
            </section>

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={avancados}
                  onChange={(event) => setAvancados(event.target.checked)}
                />
              }
              label="Mostrar campos avançados (estoque, tributação)"
            />

            {avancados ? (
              <>
                <section aria-label="Parâmetros de estoque">
                  <Typography variant="overline" color="text.secondary">
                    Parâmetros de estoque
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                    {campoTexto('minimumQuantity', 'Estoque mínimo')}
                    {campoTexto('maximumQuantity', 'Estoque máximo')}
                    {campoTexto('location', 'Localização física')}
                  </Stack>
                </section>

                <section aria-label="Tributação">
                  <Typography variant="overline" color="text.secondary">
                    Tributação
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                      select
                      label={label('origin', 'Origem da mercadoria')}
                      value={form.origin}
                      onChange={(event) =>
                        setForm((atual) => ({ ...atual, origin: event.target.value }))
                      }
                      size="small"
                      fullWidth
                    >
                      <MenuItem value="">Não informada</MenuItem>
                      {(catalog?.origins ?? []).map((item) => (
                        <MenuItem key={item.code} value={item.code}>
                          {item.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      {campoTexto('ncm', 'NCM')}
                      {campoTexto('cest', 'CEST')}
                      {campoTexto('taxGroup', 'Grupo fiscal')}
                    </Stack>
                  </Stack>
                </section>
              </>
            ) : null}

            <Divider />

            <section aria-label="Fornecedores">
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Typography variant="overline" color="text.secondary">
                  Fornecedores
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setLinhasFornecedor((atual) => [
                      ...atual,
                      { contactId: '', supplierSku: '', cost: '', isDefault: false },
                    ])
                  }
                >
                  Adicionar
                </Button>
              </Stack>

              {fornecedores.length === 0 ? (
                <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                  Nenhum contato marcado como Fornecedor. Cadastre o contato com o tipo Fornecedor
                  antes de vinculá-lo ao produto.
                </Alert>
              ) : null}

              <Stack spacing={2} sx={{ mt: 2 }}>
                {linhasFornecedor.map((linha, indice) => (
                  <Stack
                    key={`${linha.contactId}-${indice}`}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ sm: 'center' }}
                  >
                    <TextField
                      select
                      label="Fornecedor"
                      value={linha.contactId}
                      onChange={(event) =>
                        setLinhasFornecedor((atual) =>
                          atual.map((item, i) =>
                            i === indice ? { ...item, contactId: event.target.value } : item,
                          ),
                        )
                      }
                      size="small"
                      fullWidth
                    >
                      {fornecedores.map((contato) => (
                        <MenuItem key={contato.id} value={contato.id}>
                          {contato.displayName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Código no fornecedor"
                      value={linha.supplierSku}
                      onChange={(event) =>
                        setLinhasFornecedor((atual) =>
                          atual.map((item, i) =>
                            i === indice ? { ...item, supplierSku: event.target.value } : item,
                          ),
                        )
                      }
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Custo"
                      value={linha.cost}
                      onChange={(event) =>
                        setLinhasFornecedor((atual) =>
                          atual.map((item, i) =>
                            i === indice ? { ...item, cost: event.target.value } : item,
                          ),
                        )
                      }
                      size="small"
                      fullWidth
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={linha.isDefault}
                          onChange={(event) =>
                            setLinhasFornecedor((atual) =>
                              atual.map((item, i) => ({
                                ...item,
                                // Marcar um padrão DESMARCA os outros: o servidor recusa dois, e
                                // deixar a tela montar um estado que a API rejeita é fazer o
                                // operador descobrir no salvamento.
                                isDefault: i === indice ? event.target.checked : false,
                              })),
                            )
                          }
                        />
                      }
                      label="Padrão"
                    />
                    <Button
                      size="small"
                      color="error"
                      onClick={() =>
                        setLinhasFornecedor((atual) => atual.filter((_, i) => i !== indice))
                      }
                    >
                      Remover
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </section>

            {editando ? (
              <section aria-label="Situação do cadastro">
                <Typography variant="overline" color="text.secondary">
                  Para o que este cadastro serve hoje
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {editando.purposes.map((status) => (
                    <CompletudeLinha key={status.purpose} status={status} />
                  ))}
                </Stack>
              </section>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAberto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void salvar()}
            disabled={salvando || form.name.trim().length < 2 || !form.unit}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Na grade: só o quanto está pronto, sem ocupar a linha inteira. */
function CompletudeResumo({ purposes }: { purposes: ProductPurposeStatus[] }) {
  const prontos = purposes.filter((status) => status.complete).length;
  if (purposes.length === 0) {
    return <Typography variant="caption">—</Typography>;
  }
  return (
    <Tooltip
      title={purposes
        .map(
          (status) =>
            `${status.label}: ${status.complete ? 'completo' : status.missing.join(', ')}`,
        )
        .join(' · ')}
    >
      <Chip
        size="small"
        label={`${prontos}/${purposes.length}`}
        color={prontos === purposes.length ? 'success' : 'default'}
        variant="outlined"
      />
    </Tooltip>
  );
}

/**
 * No formulário: a linha por finalidade, com o que falta e — quando for o caso — o aviso de que o
 * módulo que EXECUTA aquilo não está disponível.
 *
 * O texto do aviso vem do servidor. Escrevê-lo aqui abriria a porta para a tela dizer "pronto para
 * emissão fiscal" no dia em que alguém reescrevesse este componente sem conhecer a decisão.
 */
function CompletudeLinha({ status }: { status: ProductPurposeStatus }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {status.complete ? (
          <CheckCircleOutlineIcon fontSize="small" color="success" />
        ) : (
          <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
        )}
        <Typography variant="body2">{status.label}</Typography>
      </Stack>
      {!status.complete ? (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
          Falta preencher: {status.missing.join(', ')}
        </Typography>
      ) : null}
      {status.pendenciaDeModulo ? (
        <Alert severity="info" variant="outlined" sx={{ ml: 4, mt: 0.5, py: 0 }}>
          {status.pendenciaDeModulo.message}
        </Alert>
      ) : null}
    </Box>
  );
}
