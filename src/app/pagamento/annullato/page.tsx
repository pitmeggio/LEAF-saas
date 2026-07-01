export default function PagamentoAnnullato() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f59e0b]/15 text-3xl">↩️</div>
        <h1 className="text-xl font-bold">Pagamento annullato</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Nessun importo è stato addebitato. Puoi riprovare quando vuoi dal link ricevuto.</p>
      </div>
    </main>
  );
}
