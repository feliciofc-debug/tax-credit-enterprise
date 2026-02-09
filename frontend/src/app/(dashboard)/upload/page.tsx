'use client';

import { useState, useCallback } from 'react';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState('dre');
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      files.forEach(file => formData.append('documents', file));
      formData.append('documentType', documentType);
      if (companyName) formData.append('companyName', companyName);
      if (cnpj) formData.append('cnpj', cnpj);

      const res = await fetch('/api/batch/upload', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      const data = await res.json();
      setResult(data);
      if (data.success) setFiles([]);
    } catch (error) {
      setResult({ success: false, error: 'Erro ao fazer upload' });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload de Documentos</h1>
        <p className="text-gray-500 text-sm mt-1">Envie DREs, Balancos e Balancetes para analise automatica</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`card p-8 border-2 border-dashed text-center transition-colors cursor-pointer ${
              dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.txt,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <svg className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-brand-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-700 font-medium mb-1">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-sm text-gray-500">
              PDF, Excel, TXT, Imagens - Ate 200 arquivos por lote
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-700">{files.length} arquivo(s) selecionado(s)</span>
                <button onClick={() => setFiles([])} className="text-sm text-red-500 hover:text-red-700">
                  Remover todos
                </button>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {files.map((file, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`card p-5 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`font-semibold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? 'Upload realizado com sucesso!' : 'Erro no upload'}
              </p>
              {result.success && result.data && (
                <p className="text-green-600 text-sm mt-1">
                  Lote {result.data.batchJobId} criado com {result.data.totalDocuments} documentos
                </p>
              )}
              {!result.success && (
                <p className="text-red-600 text-sm mt-1">{result.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Config */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Configuracao</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Documento</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="input"
              >
                <option value="dre">DRE</option>
                <option value="balanço">Balanco Patrimonial</option>
                <option value="balancete">Balancete</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da Empresa</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input"
                placeholder="Ex: Empresa ABC Ltda"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="input"
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Enviando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Enviar {files.length > 0 ? `${files.length} arquivo(s)` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
