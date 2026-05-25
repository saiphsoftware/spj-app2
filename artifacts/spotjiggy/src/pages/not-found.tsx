import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <div className="grid grid-cols-3 gap-2 w-24 mx-auto mb-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, delay: i * 0.15, repeat: Infinity }}
                className="aspect-square bg-muted rounded-md"
              />
            ))}
          </div>
          <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
          <p className="text-muted-foreground text-lg mb-6">This piece is missing from the puzzle.</p>
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Back to Home
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </Layout>
  );
}
