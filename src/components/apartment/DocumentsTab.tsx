import { useState } from 'react';
import { Plus, Trash2, FileText, Image, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useApp } from '@/lib/store';
import { Document, Tenant } from '@/lib/types';
import { formatDate, generateId } from '@/lib/utils-app';

function UploadModal({ open, onClose, tenantId, apartmentId }: {
  open: boolean; onClose: () => void; tenantId: string; apartmentId: string;
}) {
  const { dispatch } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: string; type: string }[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map(f => ({
      name: f.name,
      size: `${(f.size / 1024).toFixed(0)} KB`,
      type: f.type.includes('pdf') ? 'pdf' : f.type.includes('image') ? 'image' : 'other',
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }

  function handleSave() {
    files.forEach(f => {
      dispatch({
        type: 'ADD_DOCUMENT',
        payload: {
          apartmentId,
          tenantId,
          document: {
            id: generateId(),
            tenantId,
            name: f.name,
            type: f.type,
            uploadedAt: new Date().toISOString().split('T')[0],
            size: f.size,
          },
        },
      });
    });
    setFiles([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Documentos</DialogTitle>
        </DialogHeader>
        <div
          className={`mt-2 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Arraste arquivos aqui</p>
          <p className="text-xs text-muted-foreground mt-1">ou</p>
          <label className="mt-2 inline-block cursor-pointer">
            <input type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            <span className="text-sm text-primary font-medium hover:underline">Selecionar arquivos</span>
          </label>
          <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG — qualquer tamanho</p>
        </div>
        {files.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                {f.type === 'pdf' ? <FileText className="w-4 h-4 text-primary" /> : <Image className="w-4 h-4 text-primary" />}
                <span className="text-sm truncate flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.size}</span>
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={files.length === 0}>
            Salvar ({files.length} arquivo{files.length !== 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsTab({ tenant, apartmentId }: { tenant: Tenant; apartmentId: string }) {
  const { dispatch } = useApp();
  const [showUpload, setShowUpload] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Documentos</h3>
          <p className="text-sm text-muted-foreground">{tenant.documents.length} arquivo(s)</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar
        </Button>
      </div>

      {tenant.documents.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Nenhum documento cadastrado</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4 mr-2" /> Fazer upload
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tenant.documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${doc.type === 'pdf' ? 'bg-red-50' : 'bg-blue-50'}`}>
                {doc.type === 'pdf'
                  ? <FileText className="w-4 h-4 text-red-500" />
                  : <Image className="w-4 h-4 text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(doc.uploadedAt)} · {doc.size}</p>
              </div>
              <button
                onClick={() => setDeleteDoc(doc)}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        tenantId={tenant.id}
        apartmentId={apartmentId}
      />

      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteDoc?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                dispatch({ type: 'DELETE_DOCUMENT', payload: { apartmentId, tenantId: tenant.id, documentId: deleteDoc!.id } });
                setDeleteDoc(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
