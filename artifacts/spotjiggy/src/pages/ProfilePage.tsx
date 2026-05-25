import { useParams } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useGetUserProfile, useListUserActivityFeed, useGetMyStats } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ACTIVITY_ICONS: Record<string, string> = {
  joined: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  created_puzzle: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  collected_piece: "M5 13l4 4L19 7",
  completed_puzzle: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  published_puzzle: "M12 2v20M2 12h20",
};

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { isLoggedIn } = useAuth();

  const { data: profile, isLoading } = useGetUserProfile(uid);
  const { data: activity } = useListUserActivityFeed(uid);
  const { data: myStats } = useGetMyStats({ query: { enabled: isLoggedIn } });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-40 bg-card rounded-2xl border border-card-border animate-pulse" />
          <div className="h-32 bg-card rounded-2xl border border-card-border animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">User not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-card-border rounded-2xl p-6 mb-5"
        >
          <div className="flex items-center gap-4 mb-5">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-16 h-16 rounded-2xl border-2 border-primary/20"
              onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/fun-emoji/svg?seed=default"; }}
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
              <p className="text-muted-foreground text-sm">Member since {new Date(profile.created * 1000).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Pieces", value: profile.piecesCount },
              { label: "Badges", value: profile.badgesCount },
              { label: "Active", value: profile.activePuzzlesCount },
              { label: "Closed", value: profile.closedPuzzlesCount },
            ].map(stat => (
              <div key={stat.label} className="text-center p-3 bg-muted rounded-xl">
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {myStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-5 mb-5"
          >
            <h2 className="font-semibold text-foreground mb-3">Your Stats</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining Puzzles</span>
                <span className="font-semibold text-foreground">{myStats.remainingPuzzles ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Puzzles Created</span>
                <span className="font-semibold text-foreground">{myStats.puzzlesCreated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Puzzles Completed</span>
                <span className="font-semibold text-foreground">{myStats.puzzlesCompleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Badges Earned</span>
                <span className="font-semibold text-foreground">{myStats.badgesEarned}</span>
              </div>
            </div>
          </motion.div>
        )}

        {profile.badges && profile.badges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-card-border rounded-2xl p-5 mb-5"
          >
            <h2 className="font-semibold text-foreground mb-3">Badges</h2>
            <div className="flex flex-wrap gap-3">
              {profile.badges.map((badge: any) => (
                <motion.div
                  key={badge.id}
                  whileHover={{ scale: 1.08 }}
                  className="flex flex-col items-center gap-1 p-2"
                  title={badge.description ?? badge.name}
                >
                  <img src={badge.image} alt={badge.name} className="w-10 h-10 rounded-xl" onError={(e) => { (e.target as HTMLImageElement).src = "https://picsum.photos/seed/badge/40/40"; }} />
                  <span className="text-xs font-medium text-foreground text-center">{badge.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-card-border rounded-2xl p-5"
        >
          <h2 className="font-semibold text-foreground mb-4">Recent Activity</h2>
          {activity && activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                      <path d={ACTIVITY_ICONS[entry.type] ?? ACTIVITY_ICONS.joined} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{entry.details}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(entry.on)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-6">No activity yet.</p>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
