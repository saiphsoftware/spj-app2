import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useListPackages, useCreateCheckout, getGetMyStatsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function CheckoutPage() {
  const [location, navigate] = useLocation();
  const packageId = new URLSearchParams(location.split("?")[1] ?? "").get("packageId") ?? "";
  const { isLoggedIn } = useAuth();
  const [couponCode, setCouponCode] = useState("");
  const [success, setSuccess] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: packages } = useListPackages();
  const selectedPkg = packages?.find(p => p.id === packageId);

  const checkoutMutation = useCreateCheckout({
    mutation: {
      onSuccess: (data) => {
        setSuccess(data);
        queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
      },
      onError: () => toast({ title: "Checkout failed", variant: "destructive" }),
    },
  });

  if (!isLoggedIn) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Please sign in to purchase.</p>
        </div>
      </Layout>
    );
  }

  const handleCheckout = () => {
    if (!packageId) return;
    checkoutMutation.mutate({
      data: { packageId, couponCode: couponCode || null },
    });
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center bg-card border border-card-border rounded-2xl p-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Purchase Complete!</h2>
              <p className="text-muted-foreground mb-2">
                Added <span className="font-bold text-foreground">{success.puzzlesAdded}</span> puzzle slots to your account.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                You now have <span className="font-semibold text-foreground">{success.remainingPuzzles}</span> remaining slots.
              </p>
              <div className="text-xs text-muted-foreground mb-6">Transaction ID: {success.txid}</div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/")}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Start Creating Puzzles
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-2xl font-bold text-foreground mb-6">Checkout</h1>

              {selectedPkg ? (
                <div className="bg-card border border-card-border rounded-2xl p-5 mb-5">
                  <h2 className="font-semibold text-foreground mb-3">Order Summary</h2>
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-foreground">{selectedPkg.puzzleCount} Puzzle Pack</p>
                      {selectedPkg.discountName && (
                        <p className="text-xs text-secondary">{selectedPkg.discountName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">${selectedPkg.price.toFixed(2)}</p>
                      {selectedPkg.originalPrice && (
                        <p className="text-xs text-muted-foreground line-through">${selectedPkg.originalPrice.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between pt-3 font-bold text-foreground">
                    <span>Total</span>
                    <span>${selectedPkg.price.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-card-border rounded-2xl p-5 mb-5">
                  <p className="text-muted-foreground text-sm">No package selected. <a href="/store" className="text-primary hover:underline">Browse packages</a></p>
                </div>
              )}

              <div className="bg-card border border-card-border rounded-2xl p-5 mb-5">
                <h2 className="font-semibold text-foreground mb-3">Coupon Code</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    placeholder="Enter code (optional)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button className="px-4 py-2.5 border border-input rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                    Apply
                  </button>
                </div>
              </div>

              <div className="bg-muted rounded-xl p-4 mb-5 text-sm text-muted-foreground">
                This is a demo checkout. No real payment will be processed.
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                disabled={!selectedPkg || checkoutMutation.isPending}
                className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {checkoutMutation.isPending ? "Processing..." : `Complete Purchase — $${selectedPkg?.price.toFixed(2) ?? "0.00"}`}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
