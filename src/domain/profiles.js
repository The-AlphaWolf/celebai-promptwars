/**
 * Planning knowledge per event type: how budgets are usually split, which
 * vendors are needed and how far ahead they book, the milestone schedule and
 * an idea library. Figures are planning heuristics, not quotes (see README
 * "Assumptions").
 *
 * - allocation.share: fraction of the non-contingency budget.
 * - perGuest: the category scales with headcount (food, drink, rentals).
 * - vendors.leadDays: typical booking lead time before the event.
 * - milestones.daysBefore: when the task should be done; 0 = event day.
 */

export const EVENT_PROFILES = {
  wedding: {
    label: 'Wedding',
    recommendedLeadDays: 300,
    minPerGuest: 90,
    allocation: [
      { key: 'venue', category: 'Venue & Rentals', share: 0.28, color: '#F59E0B' },
      { key: 'catering', category: 'Catering & Bar', share: 0.34, color: '#10B981', perGuest: true },
      { key: 'photo', category: 'Photo & Video', share: 0.12, color: '#8B5CF6' },
      { key: 'decor', category: 'Florals & Decor', share: 0.1, color: '#EC4899' },
      { key: 'music', category: 'Music & Entertainment', share: 0.08, color: '#06B6D4' },
      { key: 'attire', category: 'Attire & Beauty', share: 0.05, color: '#F97316' },
      { key: 'stationery', category: 'Invitations & Favors', share: 0.03, color: '#3B82F6' },
    ],
    vendors: [
      { budgetKey: 'venue', category: 'Venue', name: 'Ceremony & reception venue', leadDays: 300, priority: 'Critical' },
      { budgetKey: 'catering', category: 'Catering', name: 'Full-service caterer & bar', leadDays: 240, priority: 'Critical' },
      { budgetKey: 'photo', category: 'Photography', name: 'Photographer & videographer', leadDays: 240, priority: 'High' },
      { budgetKey: 'music', category: 'Entertainment', name: 'Ceremony musicians / DJ', leadDays: 180, priority: 'High' },
      { budgetKey: 'decor', category: 'Florals', name: 'Florist & decor stylist', leadDays: 150, priority: 'Medium' },
      { budgetKey: 'attire', category: 'Attire', name: 'Attire, hair & makeup', leadDays: 120, priority: 'Medium' },
    ],
    milestones: [
      { daysBefore: 300, title: 'Book venue and lock the date', description: 'Compare at least three venues on capacity, curfew and what rentals are included.' },
      { daysBefore: 240, title: 'Book caterer and photographer', description: 'Schedule a tasting and confirm package hours and deliverables.' },
      { daysBefore: 180, title: 'Send save-the-dates', description: 'Share the date and city so out-of-town guests can plan travel.' },
      { daysBefore: 120, title: 'Order attire and confirm florist', description: 'Allow time for alterations; approve a sample centerpiece.' },
      { daysBefore: 60, title: 'Send formal invitations', description: 'Set the RSVP deadline about three weeks before the event.' },
      { daysBefore: 21, title: 'Final headcount and seating plan', description: 'Send final numbers and dietary requirements to the caterer.' },
      { daysBefore: 7, title: 'Confirm vendor run-of-show', description: 'Share the day-of timeline, contacts and arrival times with every vendor.' },
      { daysBefore: 0, time: '16:00', title: 'Ceremony', description: 'Guests seated 15 minutes before; officiant and musicians in place.' },
      { daysBefore: 0, time: '19:00', title: 'Dinner, toasts and first dance', description: 'Keep speeches under 5 minutes each to protect the dinner service.' },
    ],
    ideas: [
      { tags: ['audio', 'guestbook', 'vintage', 'classic'], category: 'Interactive', title: 'Audio guestbook phone', description: 'A vintage phone where guests leave recorded messages instead of signing a book.' },
      { tags: ['garden', 'botanical', 'outdoor', 'eco', 'floral'], category: 'Favor', title: 'Wildflower seed favors', description: 'Seed packets stamped with the date that guests plant at home.' },
      { tags: ['coffee', 'dessert', 'late', 'dance', 'party'], category: 'Food', title: 'Late-night espresso cart', description: 'A barista serving espresso and affogato to keep the dance floor going.' },
      { tags: ['photo', 'seating', 'personal', 'family'], category: 'Decor', title: 'Photo escort-card wall', description: 'A candid photo of each guest pinned next to their table number.' },
      { tags: ['candle', 'evening', 'romantic', 'gold', 'elegant'], category: 'Ambience', title: 'Candlelit sparkler exit', description: 'Guests line the exit path with sparklers for the send-off photo.' },
      { tags: ['culture', 'heritage', 'tradition', 'family'], category: 'Ceremony', title: 'Heritage ritual moment', description: 'A short ceremony element honouring each family’s tradition, explained in the program.' },
    ],
  },

  birthday: {
    label: 'Birthday',
    recommendedLeadDays: 60,
    minPerGuest: 40,
    allocation: [
      { key: 'venue', category: 'Venue & Setup', share: 0.3, color: '#F43F5E' },
      { key: 'catering', category: 'Food & Drinks', share: 0.36, color: '#8B5CF6', perGuest: true },
      { key: 'music', category: 'DJ, Lighting & Games', share: 0.16, color: '#06B6D4' },
      { key: 'cake', category: 'Cake & Desserts', share: 0.08, color: '#F59E0B' },
      { key: 'decor', category: 'Decor & Favors', share: 0.1, color: '#10B981' },
    ],
    vendors: [
      { budgetKey: 'venue', category: 'Venue', name: 'Party venue or private room', leadDays: 60, priority: 'Critical' },
      { budgetKey: 'catering', category: 'Catering', name: 'Caterer or food truck', leadDays: 45, priority: 'High' },
      { budgetKey: 'music', category: 'Entertainment', name: 'DJ / entertainment', leadDays: 30, priority: 'High' },
      { budgetKey: 'cake', category: 'Bakery', name: 'Custom cake bakery', leadDays: 21, priority: 'Medium' },
    ],
    milestones: [
      { daysBefore: 60, title: 'Book venue', description: 'Confirm capacity, noise curfew and whether outside catering is allowed.' },
      { daysBefore: 45, title: 'Send invitations', description: 'Digital invites with an RSVP link; ask for dietary needs.' },
      { daysBefore: 30, title: 'Book food, DJ and activities', description: 'Lock menus and the music brief; reserve any rentals.' },
      { daysBefore: 21, title: 'Order the cake', description: 'Share the theme and headcount with the bakery.' },
      { daysBefore: 7, title: 'Confirm headcount and buy decor', description: 'Send the final number to the caterer; prepare favors.' },
      { daysBefore: 0, time: '19:00', title: 'Doors open and welcome drinks', description: 'Greeter at the door; playlist at a conversational level.' },
      { daysBefore: 0, time: '21:30', title: 'Cake, toast and dance floor', description: 'Dim the lights for the cake, then hand over to the DJ.' },
    ],
    ideas: [
      { tags: ['retro', 'arcade', 'games', 'neon', '80s', '90s'], category: 'Interactive', title: 'Arcade tournament bracket', description: 'Rent two arcade cabinets and run a bracket with a trophy for the winner.' },
      { tags: ['memory', 'photo', 'milestone', 'decade', 'family'], category: 'Decor', title: 'Through-the-years photo timeline', description: 'A wall of photos from each year of the guest of honour’s life.' },
      { tags: ['cocktail', 'drinks', 'bar', 'signature'], category: 'Food', title: 'Signature drink named after the host', description: 'One cocktail and one mocktail named after the guest of honour.' },
      { tags: ['kids', 'family', 'craft'], category: 'Activity', title: 'Craft table for younger guests', description: 'A supervised craft station so parents can enjoy the party.' },
      { tags: ['music', 'karaoke', 'dance', 'party'], category: 'Entertainment', title: 'Karaoke hour', description: 'A one-hour karaoke slot before the DJ set to warm up the room.' },
      { tags: ['message', 'video', 'surprise', 'friends'], category: 'Surprise', title: 'Video messages from absent friends', description: 'Collect short clips in advance and play them before the cake.' },
    ],
  },

  community: {
    label: 'Community event',
    recommendedLeadDays: 120,
    minPerGuest: 15,
    allocation: [
      { key: 'venue', category: 'Site, Permits & Insurance', share: 0.24, color: '#06B6D4' },
      { key: 'stage', category: 'Stage, Sound & Power', share: 0.22, color: '#8B5CF6' },
      { key: 'catering', category: 'Food & Water Stations', share: 0.16, color: '#10B981', perGuest: true },
      { key: 'activities', category: 'Activities & Workshops', share: 0.16, color: '#F59E0B' },
      { key: 'marketing', category: 'Promotion & Signage', share: 0.1, color: '#EC4899' },
      { key: 'operations', category: 'Waste, Toilets & Cleanup', share: 0.12, color: '#64748B', perGuest: true },
    ],
    vendors: [
      { budgetKey: 'venue', category: 'Permits', name: 'Venue booking, permits & insurance', leadDays: 120, priority: 'Critical' },
      { budgetKey: 'stage', category: 'Production', name: 'Stage, PA and power supplier', leadDays: 90, priority: 'Critical' },
      { budgetKey: 'catering', category: 'Food', name: 'Food vendors / food trucks', leadDays: 60, priority: 'High' },
      { budgetKey: 'activities', category: 'Activities', name: 'Workshop hosts & performers', leadDays: 60, priority: 'High' },
      { budgetKey: 'operations', category: 'Operations', name: 'Toilets, waste & cleanup crew', leadDays: 45, priority: 'High' },
    ],
    milestones: [
      { daysBefore: 120, title: 'Secure site, permits and insurance', description: 'Apply for event, noise and food permits; get liability cover.' },
      { daysBefore: 90, title: 'Book stage, sound and power', description: 'Confirm generator or mains power and the load-in schedule.' },
      { daysBefore: 60, title: 'Recruit vendors and volunteers', description: 'Open vendor applications and a volunteer sign-up form.' },
      { daysBefore: 30, title: 'Launch promotion', description: 'Posters, local press and social posts with date, place and accessibility info.' },
      { daysBefore: 14, title: 'Safety and accessibility walkthrough', description: 'Agree first-aid point, exits, step-free routes and lost-child procedure.' },
      { daysBefore: 3, title: 'Volunteer briefing', description: 'Assign shifts, radios and the emergency contact sheet.' },
      { daysBefore: 0, time: '08:00', title: 'Load-in and site setup', description: 'Vendors on site by 08:00; safety check before gates open.' },
      { daysBefore: 0, time: '11:00', title: 'Gates open', description: 'Welcome desk, wayfinding and accessibility support staffed.' },
    ],
    ideas: [
      { tags: ['eco', 'zero-waste', 'green', 'sustainable'], category: 'Sustainability', title: 'Reusable cup deposit scheme', description: 'A small deposit on reusable cups cuts single-use waste at the bars.' },
      { tags: ['kids', 'family', 'workshop', 'craft', 'maker'], category: 'Activity', title: 'Family maker workshops', description: 'Short hands-on sessions run by local makers every hour.' },
      { tags: ['local', 'music', 'stage', 'acoustic'], category: 'Entertainment', title: 'Local talent stage', description: 'An open slot schedule for local musicians and school groups.' },
      { tags: ['food', 'local', 'market', 'harvest'], category: 'Food', title: 'Local producers market', description: 'Stalls for nearby farms and bakers to sell and sample.' },
      { tags: ['accessibility', 'inclusive', 'quiet', 'family'], category: 'Inclusion', title: 'Quiet zone', description: 'A shaded low-noise area for neurodivergent guests and young families.' },
      { tags: ['heritage', 'history', 'culture', 'story'], category: 'Culture', title: 'Neighbourhood story wall', description: 'Residents pin photos and memories to a shared board during the day.' },
    ],
  },
};

/** Extra budget lines and vendors added when the context calls for them. */
export const CONDITIONAL_ITEMS = {
  outdoor: {
    budget: { key: 'weather', category: 'Tents, Power & Weather Backup', share: 0.08, color: '#64748B' },
    vendor: { budgetKey: 'weather', category: 'Rentals', name: 'Tent, flooring & generator rental', leadDays: 90, priority: 'High' },
  },
  largeCrowd: {
    budget: { key: 'security', category: 'Security & Guest Logistics', share: 0.05, color: '#F43F5E' },
    vendor: { budgetKey: 'security', category: 'Security', name: 'Security & parking stewards', leadDays: 45, priority: 'High' },
  },
};

export const OUTDOOR_KEYWORDS = ['outdoor', 'garden', 'park', 'beach', 'vineyard', 'field', 'lawn', 'courtyard', 'rooftop', 'riverfront', 'open-air', 'farm'];
export const LARGE_CROWD_THRESHOLD = 150;
