import { VinylGrid } from "../../components/Grid/VinylGrid";
import styles from "./page.module.css";

export default function Wishlist() {
  return (
    <main className={styles.wrapper}>
      <div className={styles.glassOverlay} />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Wishlist</h1>
          <p className={styles.subtitle}>Albums you are dreaming of</p>
        </div>
        <VinylGrid statusFilter="WISH" />
      </div>
    </main>
  );
}
