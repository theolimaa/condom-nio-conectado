import { useState, useMemo } from 'react';
import {
  FileText,
  FolderOpen,
  Download,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  SaveAll,
} from 'lucide-react';import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Layout from '@/components/Layout';
import { MONTHS, YEARS } from '@/lib/utils-app';
import {
  useSavedReceipts,
  useDeleteSavedReceipt,
  useBulkSaveReceipts,
  useCleanupOldReceipts,
  refreshReceiptUrl,
  SavedReceipt,
} from '@/hooks/useReceipts';
import { useCondominiums } from '@/hooks/useCondominiums';

function formatMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function ReceiptItem({
  receipt,
  onDelete,
}: {
  receipt: SavedReceipt;
  onDelete: (r: SavedReceipt) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      let url = receipt.public_url;
      const resp = await fetch(url, { method: 'HEAD' }).catch(() => null);
      if (!resp || !resp.ok) {
        const newUrl = await refreshReceiptUrl(receipt.storage_path);
        if (!newUrl) throw new Error('URL inválida');
        url = newUrl;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `Recibo-${receipt.receipt_code}.pdf`;
      a.target = '_blank';
      a.click();
    } catch {
      window.open(receipt.public_url, '_blank');
    } finally {
      setLoading(false);
    }
  }

  const savedDate = new Date(receipt.saved_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 rounded-lg transition-colors group">
      <FileText className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {receipt.tenant_name} — Apto {receipt.apartment_unit}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatMonth(receipt.month)} · Código: {receipt.receipt_code} · Salvo
          em {savedDate}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          onClick={handleDownload}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(receipt)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function FolderSection({
  label,
  receipts,
  onDelete,
}: {
  label: string;
  receipts: SavedReceipt[];
  onDelete: (r: SavedReceipt) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <FolderOpen className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-sm">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {receipts.length} recibo{receipts.length !== 1 ? 's' : ''}
        </span>
      </button>
      {open && (
        <div className="px-2 py-2 space-y-0.5">
          {receipts.map(r => (
            <ReceiptItem key={r.id} receipt={r} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Receipts() {
  const { data: receipts = [], isLoading } = useSavedReceipts();
  const { data: condominiums = [] } = useCondominiums();
  const deleteReceipt = useDeleteSavedReceipt();
  const bulkSave = useBulkSaveReceipts();
  const cleanupOld = useCleanupOldReceipts();

  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterCondo, setFilterCondo] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<SavedReceipt | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  // Filtrar recibos
  const filtered = useMemo(() => {
    return receipts.filter(r => {
      const [y, m] = r.month.split('-').map(Number);
      if (filterYear !== 'all' && y !== Number(filterYear)) return false;
      if (filterMonth !== 'all' && m - 1 !== Number(filterMonth)) return false;
      if (filterCondo !== 'all' && r.condominium_name !== filterCondo)
        return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.tenant_name.toLowerCase().includes(s) &&
          !r.apartment_unit.toLowerCase().includes(s) &&
          !r.receipt_code.toLowerCase().includes(s) &&
          !r.condominium_name.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [receipts, filterYear, filterMonth, filterCondo, search]);

  // Agrupar por condomínio → mês
  const grouped = useMemo(() => {
    const byCondoMonth: Record<
      string,
      { condoName: string; month: string; items: SavedReceipt[] }
    > = {};
    for (const r of filtered) {
      const key = `${r.condominium_name}||${r.month}`;
      if (!byCondoMonth[key]) {
        byCondoMonth[key] = {
          condoName: r.condominium_name,
          month: r.month,
          items: [],
        };
      }
      byCondoMonth[key].items.push(r);
    }
    return Object.values(byCondoMonth).sort((a, b) => {
      const condoCmp = a.condoName.localeCompare(b.condoName);
      if (condoCmp !== 0) return condoCmp;
      return b.month.localeCompare(a.month);
    });
  }, [filtered]);

  // Lista de condomínios únicos nos recibos salvos
  const condoOptions = useMemo(() => {
    const names = [...new Set(receipts.map(r => r.condominium_name))].sort();
    return names;
  }, [receipts]);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Recibos
            </h1>
            <p className="text-muted-foreground text-sm">
              Backup de todos os recibos gerados. Clique em "Salvar" no
              financeiro de cada apartamento para arquivar aqui.
            </p>
          </div>

          {/* Botão salvar todos */}
          <div className="flex gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmCleanup(true)}
              disabled={cleanupOld.isPending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
            >
              {cleanupOld.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3 mr-1" />
              )}
              Limpar anteriores a 2026
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmBulk(true)}
              disabled={bulkSave.isPending}
            >
              {bulkSave.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <SaveAll className="w-4 h-4 mr-2" />
              )}
              {bulkSave.isPending ? 'Salvando...' : 'Salvar todos os recibos pagos'}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar inquilino, apto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm w-52"
            />
          </div>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-28 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {YEARS.map(y => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCondo} onValueChange={setFilterCondo}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os condomínios</SelectItem>
              {condoOptions.map(name => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contagem */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            {filtered.length} recibo{filtered.length !== 1 ? 's' : ''}{' '}
            encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Conteúdo */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground mb-1">
              Nenhum recibo encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              Clique em "Salvar" no modal de recibo de cada apartamento, ou use
              "Salvar todos os recibos pagos" para gerar o backup de uma vez.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(g => (
              <FolderSection
                key={`${g.condoName}||${g.month}`}
                label={`${g.condoName} — ${formatMonth(g.month)}`}
                receipts={g.items}
                onDelete={r => setToDelete(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm bulk save */}
      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar todos os recibos pagos</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá gerar e salvar PDFs de todos os registros financeiros
              marcados como <strong>pagos a partir de Janeiro de 2026</strong>.
              Recibos que já existem não serão sobrescritos. Pode levar alguns
              minutos dependendo do volume.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBulk(false);
                bulkSave.mutate();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cleanup old receipts */}
      <AlertDialog open={confirmCleanup} onOpenChange={setConfirmCleanup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover recibos anteriores a 2026</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá excluir permanentemente todos os recibos salvos com data
              anterior a Janeiro de 2026. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCleanup(false);
                cleanupOld.mutate();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Recibo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o recibo de{' '}
              <strong>{toDelete?.tenant_name}</strong> referente a{' '}
              {toDelete ? formatMonth(toDelete.month) : ''}? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  deleteReceipt.mutate({
                    id: toDelete.id,
                    storagePath: toDelete.storage_path,
                  });
                  setToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
