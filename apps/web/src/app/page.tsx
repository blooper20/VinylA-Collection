import { VinylGrid } from "../components/Grid/VinylGrid";

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#000000' }}>
      <VinylGrid statusFilter="OWNED" />
    </main>
  );
}
