// Curated system-design-interview practice prompts for Interview Mode
// (modals/interviewModeModal.js) — the same kind of question a real system
// design interview asks, so practicing here transfers. Deliberately just
// prompt text, not a rubric or expected answer: grading is left to
// io/interviewGrading.js's AI hand-off, same "no fake automatic pipeline"
// honesty this app already applies to AI Beautify Layout, version
// branching, etc.
export const INTERVIEW_PROMPTS = [
  { id: 'url-shortener', title: 'Design a URL Shortener', difficulty: 'Easy', prompt: 'Design a URL shortening service like bit.ly: given a long URL, generate a short one that redirects to it. Consider scale (billions of URLs), read/write ratio, and how you\'d pick/generate short codes without collisions.' },
  { id: 'rate-limiter', title: 'Design a Rate Limiter', difficulty: 'Easy', prompt: 'Design a rate limiter for an API: reject requests from a client once they exceed N requests per time window. Consider where it sits (client, gateway, per-service), how state is shared across multiple instances, and what happens under a burst of traffic.' },
  { id: 'parking-garage', title: 'Design a Parking Garage System', difficulty: 'Easy', prompt: 'Design the software for a multi-level parking garage: tracking free/occupied spots by vehicle size, issuing a ticket on entry, computing a fee on exit. Consider concurrent entries/exits and what happens when the garage is full.' },
  { id: 'notification-system', title: 'Design a Notification System', difficulty: 'Medium', prompt: 'Design a system that sends notifications (push, email, SMS) to users on behalf of many internal services, at scale. Consider retries/failures per channel, user preferences/opt-outs, rate limiting per user, and delivery guarantees.' },
  { id: 'ecommerce-checkout', title: 'Design an E-Commerce Checkout', difficulty: 'Medium', prompt: 'Design the checkout flow for an online store: cart, inventory reservation, payment, order confirmation. Consider what happens if payment succeeds but inventory ran out, retries on a flaky payment provider, and avoiding double-charging on a retried request.' },
  { id: 'chat-app', title: 'Design a Chat Application', difficulty: 'Medium', prompt: 'Design a one-on-one and group chat application like WhatsApp: message delivery, online/offline presence, message ordering, and read receipts. Consider how a message reaches an offline user once they come back online.' },
  { id: 'news-feed', title: "Design a Social Media News Feed", difficulty: 'Hard', prompt: 'Design the news feed for a social network: users follow other users, and see a reverse-chronological (or ranked) feed of their posts. Consider a celebrity account with millions of followers (fan-out on write vs. read), and how feed generation scales.' },
  { id: 'distributed-cache', title: 'Design a Distributed Cache', difficulty: 'Hard', prompt: 'Design a distributed, in-memory key-value cache (like a simplified Redis cluster): sharding keys across nodes, handling a node failure, and cache eviction under memory pressure. Consider consistency between the cache and the underlying database.' },
  { id: 'ride-sharing', title: 'Design a Ride-Sharing Dispatch System', difficulty: 'Hard', prompt: 'Design the core matching system for a ride-sharing app: matching nearby riders to drivers in real time, tracking live driver locations, and handling surge demand. Consider what happens when no driver is available nearby.' },
  { id: 'video-streaming', title: 'Design a Video Streaming Service', difficulty: 'Hard', prompt: 'Design a video streaming platform like YouTube: video upload/transcoding into multiple resolutions, and serving playback to millions of viewers globally with low latency. Consider storage cost at scale and how a CDN fits in.' },
];

export function getInterviewPromptById(id) {
  return INTERVIEW_PROMPTS.find((p) => p.id === id) || null;
}
