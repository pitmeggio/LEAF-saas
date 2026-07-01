export default function PagamentoOk() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-3xl">✅</div>
        <h1 className="text-xl font-bold">Pagamento completato</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Grazie! Il pagamento è andato a buon fine. Riceverai conferma via email. Puoi chiudere questa pagina.</p>
      </div>
    </main>
  );
}
