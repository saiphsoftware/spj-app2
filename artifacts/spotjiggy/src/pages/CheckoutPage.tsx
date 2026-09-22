import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import {
  useListPackages,
  useGetPayPalConfig,
  useCreatePayPalOrder,
  useCapturePayPalOrder,
  getGetMyStatsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function CheckoutPage() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const packageId = params.get("packageId") ?? "";
  const paypalState = params.get("paypal");
  const paypalToken = params.get("token");
  const { isLoggedIn } = useAuth();
  const [success, setSuccess] = useState<any>(null);
  const captureStartedRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: packages } = useListPackages();
  const { data: paypalConfig } = useGetPayPalConfig();
  const selectedPkg = packages?.find(p => p.id === packageId);

  const createOrderMutation = useCreatePayPalOrder({
    mutation: {
      onSuccess: (data) => {
        window.location.assign(data.approvalUrl);
      },
      onError: (error: any) => toast({
        title: error?.data?.error ?? "Could not start PayPal checkout",
        variant: "destructive",
      }),
    },
  });

  const captureMutation = useCapturePayPalOrder({
    mutation: {
      onSuccess: (data) => {
        setSuccess(data);
        queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
      },
      onError: (error: any) => toast({
        title: error?.data?.error ?? "Could not confirm PayPal payment",
        description: "Refresh the page to retry the payment confirmation.",
        variant: "destructive",
      }),
    },
  });

  useEffect(() => {
    if (
      !isLoggedIn ||
      paypalState !== "success" ||
      !paypalToken ||
      captureStartedRef.current === paypalToken
    ) {
      return;
    }

    captureStartedRef.current = paypalToken;
    captureMutation.mutate({ data: { orderId: paypalToken } });
  }, [captureMutation, isLoggedIn, paypalState, paypalToken]);

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
    if (!packageId || !paypalConfig?.configured) return;
    createOrderMutation.mutate({
      data: { packageId },
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
           ) : captureMutation.isPending ? (
             <motion.div
               key="capturing"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="text-center bg-card border border-card-border rounded-2xl p-8"
             >
               <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-5" />
               <h1 className="text-xl font-bold text-foreground mb-2">Confirming your payment</h1>
               <p className="text-sm text-muted-foreground">
                 PayPal approved the order. We’re securely adding your puzzle slots now.
               </p>
             </motion.div>
           ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-2xl font-bold text-foreground mb-6">Checkout</h1>

               {paypalState === "cancelled" && (
                 <div className="mb-5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
                   Your PayPal payment was cancelled. No puzzle slots were added.
                 </div>
               )}

              {selectedPkg ? (
                <div className="bg-card border border-card-border rounded-2xl p-5 mb-5">
                   <div className="flex items-center justify-between mb-3">
                     <h2 className="font-semibold text-foreground">Order Summary</h2>
                     <span className="text-xs font-semibold text-muted-foreground">1 item</span>
                   </div>
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-foreground">{selectedPkg.puzzleCount} Puzzle Pack</p>
                       <p className="text-xs text-muted-foreground mt-1">Creator slots · delivered instantly</p>
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

               <div className="bg-muted rounded-xl p-4 mb-5 text-sm text-muted-foreground">
                 You’ll be redirected to PayPal to review and approve this one-time payment. SpotJiggy never sees your PayPal password.
               </div>

               {!paypalConfig?.configured && (
                 <div className="mb-5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
                   PayPal setup is pending. Add <span className="font-mono text-xs">PAYPAL_CLIENT_ID</span> and <span className="font-mono text-xs">PAYPAL_CLIENT_SECRET</span> to the API server to enable checkout.
                 </div>
               )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                 disabled={!selectedPkg || !paypalConfig?.configured || createOrderMutation.isPending}
                 className="w-full py-3.5 bg-[#0070ba] text-white font-bold rounded-xl hover:bg-[#005ea6] transition-colors disabled:opacity-50"
              >
                 {createOrderMutation.isPending ? "Opening PayPal..." : `Pay with PayPal — $${selectedPkg?.price.toFixed(2) ?? "0.00"}`}
              </motion.button>
               <p className="text-center text-xs text-muted-foreground mt-3">Secure checkout · No shipping required</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
