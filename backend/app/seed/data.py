"""Demo content: who the users are and what their conversations say.

Pure data, no database code. All people and numbers are fictional (nothing is ever sent to the
numbers: verification is mocked). `ago_min` is "minutes before seeding"; lines are oldest first.
A line replies to an earlier one in the same conversation via `quote`: the start of that message's
text. Images are keys into `assets/scenes`, avatars into `assets/avatars` and `assets/groups`.
"""

from dataclasses import dataclass, field

SYSTEM = "system"


@dataclass(frozen=True)
class UserSpec:
    key: str
    first: str
    last: str
    phone: str
    username: str
    about: str | None
    seen_ago_min: int
    avatar: str | None = None  # assets/avatars/<avatar>.png


@dataclass(frozen=True)
class Line:
    sender: str
    body: str | None
    ago_min: int
    quote: str | None = None
    reactions: dict[str, str] = field(default_factory=dict)
    image: str | None = None  # assets/scenes/<image>.png
    event: str | None = None  # system lines only
    targets: tuple[str, ...] = ()
    actor: str | None = None


@dataclass(frozen=True)
class DirectSpec:
    a: str
    b: str
    lines: list[Line]
    unread: dict[str, int] = field(default_factory=dict)
    timer_seconds: int | None = None
    # The last message hasn't reached this user yet (they're offline), so the sender sees "sent".
    undelivered_last_to: str | None = None


@dataclass(frozen=True)
class GroupSpec:
    name: str
    description: str
    creator: str
    admins: tuple[str, ...]
    members: tuple[str, ...]
    lines: list[Line]
    unread: dict[str, int] = field(default_factory=dict)
    avatar: str | None = None  # assets/groups/<avatar>.png


L = Line

USERS = [
    UserSpec(
        "sanyam",
        "Sanyam",
        "Wadhwa",
        "+919876500001",
        "sanyam_w.01",
        "Building things 🚀",
        0,
        "sanyam",
    ),
    UserSpec(
        "aarav", "Aarav", "Sharma", "+919876500002", "aarav_s.07", "At the gym 💪", 12, "aarav"
    ),
    UserSpec(
        "simran", "Simran", "Kaur", "+919876500003", "simran_k.12", "Chai first ☕", 3, "simran"
    ),
    UserSpec(
        "harpreet",
        "Harpreet",
        "Singh",
        "+919876500004",
        "harpreet_s.33",
        "Busy, DSA grind",
        95,
        "harpreet",
    ),
    UserSpec(
        "ishita", "Ishita", "Gupta", "+919876500005", "ishita_g.21", "Photography 📷", 400, "ishita"
    ),
    UserSpec("kabir", "Kabir", "Malhotra", "+919876500006", "kabir_m.45", None, 1500),
    UserSpec(
        "tanvi",
        "Tanvi",
        "Bansal",
        "+919876500007",
        "tanvi_b.04",
        "Trekking enthusiast 🥾",
        30,
        "tanvi",
    ),
    UserSpec(
        "rohan", "Rohan", "Verma", "+919876500008", "rohan_v.19", "Backend nerd ⚙️", 2600, "rohan"
    ),
    UserSpec(
        "neha", "Neha", "Wadhwa", "+919876500009", "neha_w.02", "Product @ Gurugram", 240, "neha"
    ),
    UserSpec(
        "anita", "Anita", "Wadhwa", "+919876500010", "anita_w.05", "Ghar ka khana 🍛", 60, "anita"
    ),
    UserSpec(
        "dhruv", "Dhruv", "Mehta", "+919876500011", "dhruv_m.14", "Hostel H, room 214", 20, "dhruv"
    ),
    UserSpec("arjun", "Arjun", "Kapoor", "+919876500012", "arjun_k.09", "Captain 🏏", 7, "arjun"),
    UserSpec(
        "kriti", "Kriti", "Arora", "+919876500013", "kriti_a.28", "Grinding LeetCode", 110, "kriti"
    ),
]

# owner -> {contact: nickname}. A nickname is how the *owner* sees that person.
CONTACTS: dict[str, dict[str, str | None]] = {
    "sanyam": {
        "aarav": None,
        "simran": None,
        "harpreet": None,
        "ishita": None,
        "tanvi": None,
        "rohan": None,
        "neha": "Didi",
        "anita": "Mummy",
        "dhruv": None,
        "arjun": None,
        "kriti": None,
    },
    "aarav": {"sanyam": None, "simran": None},
    "simran": {"sanyam": None, "aarav": None, "ishita": None},
    "harpreet": {"sanyam": None},
    "ishita": {"sanyam": None, "simran": None},
    "dhruv": {"sanyam": None},
}

DIRECTS = [
    # ------------------------------------------------------------------ Aarav (gym buddy)
    DirectSpec(
        "sanyam",
        "aarav",
        unread={"sanyam": 3},
        lines=[
            L("aarav", "Bhai kal ka leg day yaad hai na? 😤", 4300),
            L("sanyam", "Haan haan, 6 baje uthna padega warna tu phir gussa karega", 4295),
            L(
                "aarav",
                "Exactly. Don't skip, tera streak 12 days ka hai",
                4290,
                reactions={"sanyam": "💪"},
            ),
            L("sanyam", "Done ✅ squats ne jaan nikaal di", 4100),
            L("aarav", "Welcome to my world. Protein shake at the canteen?", 4095),
            L("sanyam", "Only if they have the chocolate one", 4090),
            L("aarav", "They better", 4085),
            L("aarav", "Oye Sanyam! Saturday ka plan pakka hai na?", 2900),
            L("sanyam", "Haan bhai! Gym at 9, then breakfast at the canteen?", 2890),
            L("aarav", "Perfect. I'll grab a table.", 2885, reactions={"sanyam": "👍"}),
            L("sanyam", "Can we make it 11:30? Simran might join", 2880),
            L("aarav", "Sure, she's welcome 🙂", 2878),
            L("aarav", "Bro did you see the intern shortlist?", 2100),
            L("sanyam", "Not yet, kya hua?", 2095),
            L("aarav", "Seniors are saying the Scaler assignment is a Signal clone 👀", 2090),
            L("sanyam", "Yeah I got the mail today 😅 deadline Friday", 2085),
            L("aarav", "Respect. Don't forget to sleep", 2080),
            L("sanyam", "Sleep is a feature we'll add in v2", 2075, reactions={"aarav": "😂"}),
            L("sanyam", "Did you watch the match last night?", 1500),
            L(
                "aarav",
                "Don't remind me... that last-over six 😭",
                1495,
                quote="Did you watch the match",
            ),
            L(
                "sanyam",
                "Next time we watch it together in the common room",
                1490,
                reactions={"aarav": "😂"},
            ),
            L("aarav", "Common room ka TV hi kharab hai 🤡", 1480),
            L("sanyam", "Then hostel mess it is", 1470),
            L("aarav", "Deal. Also, did you finish the DSA assignment?", 240),
            L("sanyam", "Almost, submitting it by tonight", 235),
            L("aarav", "No rush, just checking in", 230),
            L("aarav", "By the way, bring your charger tomorrow", 45),
            L("aarav", "Mine died on the way to the library 😅", 44),
            L("aarav", "Also, what time was it again?", 12),
        ],
    ),
    # ------------------------------------------------------------------ Simran (project partner)
    DirectSpec(
        "sanyam",
        "simran",
        lines=[
            L("simran", "Hey Sanyam, did you get the project brief from Prof. Gill?", 3900),
            L("sanyam", "Yes! Sent it in the group too", 3895),
            L("simran", "Cool. I'll do the DB schema, you take the frontend?", 3890),
            L("sanyam", "Perfect split", 3885),
            L("simran", "Schema draft: users, conversations, messages, receipts. Thoughts?", 3000),
            L(
                "sanyam",
                "Looks clean. Maybe add a unique key for direct chats so we never create duplicates",
                2990,
            ),
            L(
                "simran",
                "Ooh good catch. direct_key = minId:maxId?",
                2985,
                quote="Looks clean. Maybe add a unique key",
            ),
            L("sanyam", "Exactly that 💯", 2980, reactions={"simran": "🔥"}),
            L("simran", "Morning! Chai at the canteen?", 1900),
            L("sanyam", "Always. The usual spot?", 1895),
            L("simran", "Yes! I'll grab the table near the fountain", 1893),
            L("sanyam", "On my way ☕", 1890, reactions={"simran": "❤️"}),
            L("simran", "Look, they finally started making cutting chai 😍", 1500),
            L("simran", "Canteen special today", 1499, image="chai"),
            L("sanyam", "Okay now I'm definitely coming", 1495),
            L("simran", "Btw, loved your UI mock-ups for the project", 800),
            L(
                "sanyam",
                "Thanks! Took a while to get the spacing right",
                790,
                quote="Btw, loved your UI",
            ),
            L("simran", "Worth it. Can you share the Figma link?", 785),
            L("sanyam", "Sent it to your Thapar mail", 780),
            L("simran", "Got it 🙌", 775, reactions={"sanyam": "🎉"}),
            L(
                "sanyam",
                "FYI the repo is here: https://github.com/SanyamWadhwa07/signal-clone",
                300,
            ),
            L("simran", "Bookmarked 🔖", 298),
            L("simran", "Also, demo day kab hai? I'll bring snacks", 118),
            L("sanyam", "Friday evening, right after submission", 115),
            L("simran", "Perfect, party on you then 😎", 110, reactions={"sanyam": "😂"}),
        ],
    ),
    # ------------------------------------------------------------------ Harpreet (code review, disappearing)
    DirectSpec(
        "sanyam",
        "harpreet",
        unread={"harpreet": 1},
        timer_seconds=7 * 86400,
        undelivered_last_to="harpreet",
        lines=[
            L("harpreet", "Sanyam, DSA ka graph wala question samjha?", 4000),
            L("sanyam", "BFS wala? Haan, visited array se ho jata hai", 3990),
            L("harpreet", "Bhai mera TLE aa raha 😭", 3985),
            L(
                "sanyam",
                "Use an adjacency list instead of a matrix, O(V+E)",
                3980,
                reactions={"harpreet": "🙏"},
            ),
            L("harpreet", "Ohh that was it. Thanks a ton 🙌", 3970),
            L("sanyam", "Hey Harpreet, can you review my PR?", 1200),
            L("harpreet", "Sure, send me the link", 1190),
            L("sanyam", "Here: https://github.com/SanyamWadhwa07/signal-clone/pull/42", 1185),
            L("harpreet", "Looks good overall. A few nits on naming", 1000),
            L("sanyam", "Like what?", 990),
            L("harpreet", "msgs → messages, cb → onChange. Readability matters", 985),
            L("sanyam", "Fixed all of them. Pushed again", 960),
            L("harpreet", "Approved ✅", 950, reactions={"sanyam": "👍"}),
            L("sanyam", "Thanks! Merge when you're free", 940),
            L("harpreet", "Merged 🚀 CI is green too", 600),
            L("sanyam", "Legend 🙏", 595),
            L("harpreet", "Placement prep ke liye mock interview kare kal?", 120),
            L("sanyam", "Sure, evening 6?", 115),
            L("harpreet", "Done. Bring a pen, whiteboard is shared 😅", 110),
            L("sanyam", "Also, are you joining the standup tomorrow?", 5),
        ],
    ),
    # ------------------------------------------------------------------ Ishita (photography)
    DirectSpec(
        "sanyam",
        "ishita",
        lines=[
            L("ishita", "Sanyam, can you check my portfolio site? Feedback chahiye", 2500),
            L("sanyam", "Sure, send the link", 2495),
            L("ishita", "https://example.com/ishita-portfolio", 2490),
            L(
                "sanyam",
                "Hero section is gorgeous. Maybe increase the contrast on the subtitle?",
                2480,
            ),
            L("ishita", "Haha my designer friend said the same 😅", 2475),
            L("ishita", "Look what I shot near Sheesh Mahal yesterday!", 600),
            L("ishita", "Patiala at golden hour", 599, image="lagoon"),
            L("sanyam", "Wow, that colour is unreal 😍", 590, quote="Patiala at golden hour"),
            L("ishita", "Thanks! I can print one for your hostel room", 585),
            L("sanyam", "Yes please! It'll go right above my desk", 580, reactions={"ishita": "❤️"}),
            L("ishita", "Another one from this morning", 300),
            L("ishita", "Mist over the fields, 6:40 AM", 299, image="dawn"),
            L("sanyam", "Okay that's going on the wall too", 295),
            L("ishita", "Done deal. Two prints, my treat", 290),
            L("ishita", "Also the design review is at 4 tomorrow, don't forget", 60),
            L("sanyam", "Noted ✅", 55),
        ],
    ),
    # ------------------------------------------------------------------ Note to Self
    DirectSpec(
        "sanyam",
        "sanyam",
        lines=[
            L("sanyam", "Pick up laundry from the hostel counter", 3000),
            L("sanyam", "Call Mummy on Sunday", 2400),
            L("sanyam", "Reminder: submit the assignment before Friday 6 PM", 1400),
            L(
                "sanyam",
                "Record the demo video: sign in, send a message, show typing + read receipts",
                700,
            ),
            L("sanyam", "Ideas: dark mode toggle, keyboard shortcuts, reactions", 300),
        ],
    ),
    # ------------------------------------------------------------------ Aarav ↔ Simran (not involving Sanyam)
    DirectSpec(
        "aarav",
        "simran",
        lines=[
            L("aarav", "Simran, are you joining us on Saturday?", 1000),
            L("simran", "Sanyam told me. Count me in!", 990),
            L("aarav", "Awesome 🎉", 985, reactions={"simran": "🎉"}),
        ],
    ),
    # ------------------------------------------------------------------ Rohan (backend mentor)
    DirectSpec(
        "sanyam",
        "rohan",
        unread={"sanyam": 2},
        lines=[
            L("rohan", "Yo, are you using Redis for presence?", 3500),
            L("sanyam", "Nope, in-memory ConnectionManager. Single worker, documented", 3495),
            L("rohan", "Fair for a demo. Redis pub/sub when you scale 👍", 3490),
            L("sanyam", "Added rate limiting btw: sliding window per user", 3300),
            L("rohan", "Nice, don't forget the Retry-After header", 3290),
            L("sanyam", "Already there 😎", 3285, reactions={"rohan": "🔥"}),
            L(
                "rohan",
                "Hey! Saw your PR on the websocket manager. Nice use of a per-socket lock 👀",
                1800,
            ),
            L(
                "sanyam",
                "Thanks! Without it two publishers could interleave frames on one connection",
                1790,
                quote="Hey! Saw your PR",
            ),
            L("rohan", "Makes sense. Are you handling reconnects on the client?", 1785),
            L(
                "sanyam",
                "Yep: exponential backoff with jitter, then a gap-fill by message id",
                1780,
                reactions={"rohan": "🔥"},
            ),
            L("rohan", "That's the right approach. Ping me when the demo is up", 1775),
            L("sanyam", "Will do. Deploying to Render + Vercel tonight", 700),
            L("rohan", "Render's free tier sleeps, so warm it up before the demo", 130),
            L("rohan", "Also double-check CORS 😅", 128),
        ],
    ),
    # ------------------------------------------------------------------ Tanvi (trekking)
    DirectSpec(
        "sanyam",
        "tanvi",
        lines=[
            L(
                "tanvi",
                "Trek ke liye shoes le liye? Last time tune sandals pehen ke aaya tha 😂",
                5400,
            ),
            L("sanyam", "Arre wo ek baar ki baat thi 😅 ab proper trekking shoes hain", 5395),
            L("tanvi", "Good. Also carry a poncho, Kasauli mein baarish ka bharosa nahi", 5390),
            L("sanyam", "Noted 🫡", 5385),
            L("tanvi", "Sunrise from Kasauli this morning! 🌄", 5000),
            L("tanvi", "Kasauli, 6:12 AM", 4999, image="sunset"),
            L(
                "sanyam",
                "Wow, that's unreal. Worth the early start",
                4990,
                quote="Kasauli, 6:12 AM",
            ),
            L("tanvi", "You have to come next time", 4985, reactions={"sanyam": "❤️"}),
            L("sanyam", "Saturday works. I'll bring chai ☕", 4980),
            L("tanvi", "Deal!", 4975),
            L("tanvi", "Playlist for the trek? Send your favourites", 800),
            L("sanyam", "Arijit Singh and some lo-fi, safe choices", 795),
            L("tanvi", "Boring but acceptable 😂", 790, reactions={"sanyam": "😂"}),
        ],
    ),
    # ------------------------------------------------------------------ Mummy
    DirectSpec(
        "sanyam",
        "anita",
        unread={"sanyam": 2},
        lines=[
            L("anita", "Beta, khana kha liya?", 4200),
            L("sanyam", "Haan Mummy, mess mein khaya", 4195),
            L("anita", "Kya khaya? Sabzi theek thi?", 4190),
            L("sanyam", "Paneer tha, theek tha 😅", 4185),
            L(
                "anita",
                "Thoda ghar ka khana miss kar raha hoga. Aate waqt parathe bana dungi",
                4180,
            ),
            L("sanyam", "Yesss please 🤤", 4175, reactions={"anita": "❤️"}),
            L("anita", "Papa keh rahe the Diwali pe aa jaana", 2600),
            L("sanyam", "Haan, train ticket book kar lunga", 2595),
            L("anita", "Waiting 🥹", 2590),
            L("anita", "Beta assignment kaisa chal raha hai?", 1300),
            L("sanyam", "Chal raha hai Mummy, Friday ko submit karna hai", 1295),
            L("anita", "Dhyan se karna, raat ko jaldi so jaana", 1290),
            L("sanyam", "Ji Mummy 🙏", 1285),
            L("anita", "Dekh, chai pe charcha ☕", 900),
            L("anita", "Garam garam adrak wali chai", 899, image="chai"),
            L("sanyam", "Mujhe bhi chahiye 😭", 895),
            L("anita", "Aaj dahi-bhalle banaye, tujhe yaad kiya", 200),
            L("sanyam", "Itna mat rulao 😭", 190),
            L("anita", "Call kar sakta hai?", 60),
            L("anita", "Papa bhi baat karna chahte hain", 58),
        ],
    ),
    # ------------------------------------------------------------------ Didi
    DirectSpec(
        "sanyam",
        "neha",
        lines=[
            L("neha", "Chhote, kaisa hai? Placement season aa raha hai 😄", 5400),
            L("sanyam", "Bas didi, assignment aur DSA mein ghis raha hoon", 5395),
            L("neha", "You'll crush it. Remember what I told you: build things, ship things", 5390),
            L("sanyam", "Yes boss 🫡", 5385),
            L("neha", "Check this view from the new office", 3100),
            L("neha", "Gurugram, 18th floor", 3099, image="city"),
            L("sanyam", "Wow! Want!!", 3095, quote="Gurugram, 18th floor"),
            L("sanyam", "Didi, resume review kar dogi?", 2000),
            L("neha", "Send karo, kal tak feedback de dungi", 1995),
            L("sanyam", "Thanks! 🙏", 1990),
            L("neha", "Resume feedback sent on mail. Add metrics to every bullet", 400),
            L("sanyam", "Will do 🙌", 395, reactions={"neha": "👍"}),
            L("neha", "And call Mummy, she's been asking about you 😄", 120),
        ],
    ),
    # ------------------------------------------------------------------ Dhruv (roommate)
    DirectSpec(
        "sanyam",
        "dhruv",
        lines=[
            L("dhruv", "Bro, hostel ka wifi phir down hai", 3700),
            L("sanyam", "Phir se? Warden ko bolna padega", 3695),
            L("dhruv", "Already mail kiya. Lagta hai router jal gaya 😂", 3690),
            L("dhruv", "Laundry guy aaya? Mere kapde dene the", 3000),
            L("sanyam", "Haan, 4 baje tak aayega", 2995),
            L("dhruv", "Midnight Maggi?", 2400),
            L("sanyam", "Always 😋", 2395, reactions={"dhruv": "🍜"}),
            L("dhruv", "Tera table lamp nahi mil raha, tune liya?", 1500),
            L("sanyam", "Nahi bhai, wo toh tere bed ke neeche hai 😂", 1495),
            L("dhruv", "Mil gaya 🙏", 1490),
            L("dhruv", "Reminder: room check kal subah 9 baje", 300),
            L("sanyam", "Thanks for reminding. Cleaning mode on 🧹", 295),
        ],
    ),
    # ------------------------------------------------------------------ Kriti (DSA study partner)
    DirectSpec(
        "sanyam",
        "kriti",
        lines=[
            L("kriti", "Sanyam, trees ke questions kal kare?", 2200),
            L("sanyam", "Sure. 10 questions from LeetCode?", 2195),
            L("kriti", "Medium wale. Easy se kuch nahi seekhte 😤", 2190),
            L("sanyam", "Challenge accepted", 2185),
            L("kriti", "Solved the LCA one finally 🥳", 1800),
            L("sanyam", "Proud of you!", 1795, reactions={"kriti": "🎉"}),
            L("kriti", "Ab tu bata, tera kaisa raha?", 1790),
            L("sanyam", "Two done, one TLE. Debugging", 1785),
            L("kriti", "Mock interview ka slot book kiya, Sunday 5 PM", 500),
            L("sanyam", "Done, I'll be there", 495),
            L("kriti", "Bring your A game 😎", 490),
        ],
    ),
]

GROUPS = [
    # ------------------------------------------------------------------ Kasauli Trek
    GroupSpec(
        name="Kasauli Trek 🥾",
        description="Trails, snacks and bad jokes. Saturdays at 7am.",
        creator="sanyam",
        admins=("sanyam", "aarav"),
        members=("sanyam", "aarav", "simran", "harpreet", "tanvi"),
        unread={"sanyam": 3},
        avatar="kasauli",
        lines=[
            L(SYSTEM, None, 6200, event="created"),
            L("sanyam", "Welcome to the trek group! 🥾", 6190),
            L(SYSTEM, None, 6185, event="promoted", targets=("aarav",), actor="sanyam"),
            L("tanvi", "Excited! Which trail are we taking?", 6180),
            L("sanyam", "Monkey Point, about 8 km round trip", 6170, quote="Excited! Which trail"),
            L("harpreet", "Is it beginner friendly?", 6160),
            L("tanvi", "Moderate. Lots of views though 😍", 6155, quote="Is it beginner friendly"),
            L(
                "aarav",
                "I'll bring the snacks (aloo parathas 😋)",
                6140,
                reactions={"sanyam": "🙌"},
            ),
            L("simran", "I'll bring the speaker 🎶", 6130, reactions={"aarav": "😂"}),
            L("sanyam", "Preview of what awaits us", 5900, image="sunset"),
            L("harpreet", "Okay that settles it, I'm in", 5890, quote="Preview of what awaits"),
            L("tanvi", "Budget? Bus se jaana hai ya cab?", 5400),
            L("aarav", "Bus is ₹120 each way, cab is ₹2k split five ways", 5395),
            L("simran", "Cab is faster, bus is cheaper. Vote?", 5390),
            L(
                "sanyam",
                "Bus. More adventure 😄",
                5380,
                reactions={"tanvi": "👍", "harpreet": "👍"},
            ),
            L("harpreet", "Bus then. Shared seats lol", 5370),
            L("sanyam", "Trek is on Saturday. Weather check: clear skies ☀️", 3000),
            L("tanvi", "Carry jackets, it gets cold at the top", 2990),
            L("aarav", "And one extra water bottle each", 2980),
            L("simran", "Also a power bank, I'll click lots of photos 📸", 2970),
            L("harpreet", "I'll bring a first-aid kit", 2960),
            L("sanyam", "Perfect team 😎", 2950),
            L("tanvi", "Weather looks great for Saturday", 600),
            L("aarav", "Meet at 7am at the bus stand?", 590),
            L("simran", "7 is early but okay 😴", 585, reactions={"sanyam": "😂", "aarav": "👍"}),
            L("tanvi", "Don't forget water and sunscreen", 120),
            L("harpreet", "Anyone have a spare backpack?", 40),
            L("aarav", "I do, will bring it", 35, quote="Anyone have a spare backpack"),
        ],
    ),
    # ------------------------------------------------------------------ Hackathon Team
    GroupSpec(
        name="Hackathon Team 🚀",
        description="Hackathon prep. Daily standup at 9 PM.",
        creator="simran",
        admins=("simran",),
        members=("simran", "sanyam", "ishita", "kabir", "rohan"),
        avatar="hackathon",
        lines=[
            L(SYSTEM, None, 5000, event="created"),
            L("simran", "Kickoff notes are in the doc, please go through them tonight", 4990),
            L("kabir", "Thanks Simran, reading now", 4980),
            L("ishita", "Problem statement is wild. Real-time collab for rural clinics?", 4900),
            L("rohan", "That's actually a good fit for websockets", 4890),
            L("sanyam", "I can handle the realtime layer + UI", 4880, reactions={"rohan": "🔥"}),
            L("kabir", "I'll take the database and APIs", 4870),
            L("ishita", "Then I'll do design + the pitch deck", 4860),
            L(
                "simran",
                "And I'll coordinate + write the docs. Split locked ✅",
                4850,
                reactions={"sanyam": "👍"},
            ),
            L("ishita", "Can we move the design review to Thursday?", 2900),
            L("simran", "Works for me", 2890, quote="Can we move the design review"),
            L("rohan", "Thursday works for me too", 2880, reactions={"simran": "👍"}),
            L("sanyam", "Same. I'll prepare the mock-ups", 2870),
            L("kabir", "Backend API draft is ready for feedback", 400),
            L("rohan", "Nice. Any breaking changes?", 395, quote="Backend API draft is ready"),
            L("kabir", "None, only additive", 390),
            L("simran", "Great. Let's ship it", 380, reactions={"kabir": "🚀"}),
            L("ishita", "Slides v1 done, link in the doc", 200),
            L("sanyam", "Looks clean! Add a slide on the architecture?", 190),
            L("ishita", "On it 👌", 185),
        ],
    ),
    # ------------------------------------------------------------------ Scaler Interns 2026
    GroupSpec(
        name="Scaler Interns 2026 🎓",
        description="Assignment questions, deadlines and moral support.",
        creator="harpreet",
        admins=("harpreet",),
        members=("harpreet", "sanyam", "kabir", "rohan", "tanvi"),
        avatar="interns",
        lines=[
            L(SYSTEM, None, 2600, event="created"),
            L("harpreet", "Welcome everyone! Use this group for assignment questions", 2590),
            L("kabir", "Has anyone started the Signal clone yet?", 2580),
            L(
                "sanyam",
                "Yes! FastAPI + Next.js, real-time over WebSockets",
                2570,
                quote="Has anyone started",
            ),
            L("rohan", "How are you doing receipts?", 2560),
            L(
                "sanyam",
                "Per-recipient rows; the status is the aggregate: sent → delivered → read",
                2550,
                quote="How are you doing receipts",
                reactions={"rohan": "👍", "harpreet": "🙌"},
            ),
            L("tanvi", "Mine only does 1:1 so far 😅", 2540),
            L("kabir", "Is the UI supposed to look exactly like Signal?", 2400),
            L("sanyam", "Yes, pixel-close. I used their published colours + fonts", 2395),
            L(
                "harpreet",
                "Don't forget the README, they evaluate it too",
                2390,
                reactions={"tanvi": "💯"},
            ),
            L("rohan", "And a hosted link. Render free tier is fine", 2385),
            L(
                "harpreet",
                "Deadline is Friday 6 PM, don't leave deployment for the last hour",
                300,
                reactions={"kabir": "💯"},
            ),
            L("kabir", "Already burned once by CORS 😭", 290),
            L(
                "sanyam",
                "Same. I tested with two origins to be sure",
                280,
                quote="Already burned once by CORS",
            ),
            L("tanvi", "Anyone free for a quick call to compare schemas?", 120),
            L("rohan", "I'm in, give me 10 minutes", 115),
        ],
    ),
    # ------------------------------------------------------------------ Hostel H Gang
    GroupSpec(
        name="Hostel H Gang 🏠",
        description="Room 214 and neighbours. Mess updates, midnight Maggi, chaos.",
        creator="dhruv",
        admins=("dhruv", "arjun"),
        members=("dhruv", "sanyam", "arjun", "aarav", "kabir"),
        unread={"sanyam": 4},
        avatar="hostel",
        lines=[
            L(SYSTEM, None, 7000, event="created"),
            L("dhruv", "Welcome to the official Hostel H gang group 🏠", 6990),
            L("arjun", "Rule 1: nobody touches my Maggi", 6980),
            L(
                "kabir",
                "Rule 2: whoever finishes the milk buys the milk",
                6970,
                reactions={"dhruv": "😂"},
            ),
            L("aarav", "Rule 3: gym at 6, no excuses 💪", 6960),
            L(
                "sanyam",
                "Rule 4: shh, I'm coding 🤫",
                6950,
                reactions={"arjun": "😂", "kabir": "😂"},
            ),
            L("dhruv", "Mess menu today: rajma chawal. Reply with your feelings", 4000),
            L("kabir", "😐", 3995),
            L("arjun", "Bhai it's rajma chawal, be grateful", 3990),
            L("aarav", "Rajma is protein, I'm in 💪", 3985),
            L("sanyam", "Can confirm, it was decent today", 3980),
            L("arjun", "Midnight Maggi at 12?", 2400),
            L("dhruv", "Count me in", 2395),
            L("kabir", "Bring extra masala", 2390),
            L("sanyam", "I'll bring the kettle", 2385, reactions={"arjun": "👌"}),
            L("dhruv", "Look at this view from the terrace tonight", 2300),
            L("dhruv", "Patiala nights 🌙", 2299, image="city"),
            L("arjun", "Okay that's actually nice", 2295),
            L("kabir", "Terrace party this weekend?", 2290, reactions={"sanyam": "🙌"}),
            L("sanyam", "After Friday, yes. I'm locked in till the deadline", 2285),
            L("arjun", "Wifi is down again in the C wing", 900),
            L("dhruv", "Warden said they're replacing the router", 895),
            L("kabir", "Say that every week 😭", 890, reactions={"dhruv": "😂"}),
            L("arjun", "Laundry guy is here, collect your clothes", 200),
            L("dhruv", "Whose red hoodie is on the common table?", 150),
            L("kabir", "Not mine", 145),
            L("aarav", "Mine, thanks!", 140),
            L("arjun", "Room check tomorrow 9 AM, clean up everyone 🧹", 60),
            L("dhruv", "Hide the extension cords 😂", 55),
        ],
    ),
    # ------------------------------------------------------------------ Cricket Sunday
    GroupSpec(
        name="Cricket Sunday 🏏",
        description="Sunday 7 AM at the main ground. Bring your own bat.",
        creator="arjun",
        admins=("arjun",),
        members=("arjun", "sanyam", "aarav", "rohan", "dhruv", "harpreet"),
        unread={"sanyam": 2},
        avatar="cricket",
        lines=[
            L(SYSTEM, None, 5600, event="created"),
            L("arjun", "Sunday match: 7 AM, main ground. 6-a-side", 5590),
            L("aarav", "I'll open the batting 😎", 5580),
            L(
                "rohan",
                "Last time you got out on the first ball 😂",
                5570,
                quote="I'll open the batting",
            ),
            L(
                "aarav",
                "Warm-up ball, doesn't count",
                5565,
                reactions={"harpreet": "😂", "dhruv": "😂"},
            ),
            L("sanyam", "I'm bowling. Can't bat, but I can bowl wides 🙃", 5550),
            L("harpreet", "Wide ball specialist, noted", 5545),
            L("arjun", "Teams: Arjun, Sanyam, Rohan vs Aarav, Dhruv, Harpreet", 4000),
            L("dhruv", "Unfair, you have the captain", 3995),
            L("arjun", "Captain's privilege 😌", 3990, reactions={"rohan": "🏏"}),
            L("rohan", "Stumps are in my room, I'll carry them", 3500),
            L("aarav", "I'll get the ball. Leather this time", 3490),
            L("harpreet", "Not leather please, my fingers 🥲", 3485),
            L("arjun", "Tennis ball with tape then", 3480, reactions={"harpreet": "🙏"}),
            L("sanyam", "Match highlights from last week, found this!", 1500),
            L("sanyam", "Aarav's famous six", 1499, image="lagoon"),
            L("aarav", "That's the sea, not the ground 😂", 1495),
            L("arjun", "Please be on time tomorrow, 7 sharp", 200),
            L("dhruv", "Alarm set ⏰", 195),
            L("rohan", "Bring water bottles", 40),
            L("harpreet", "And sunscreen!", 35),
        ],
    ),
    # ------------------------------------------------------------------ CSE 2027 batch
    GroupSpec(
        name="CSE 2027 Batch 🎓",
        description="Official-ish batch updates. Assignment deadlines and notes.",
        creator="kabir",
        admins=("kabir", "simran"),
        members=("kabir", "simran", "kriti", "ishita", "sanyam", "tanvi", "rohan", "arjun"),
        unread={"sanyam": 5},
        avatar="batch",
        lines=[
            L(SYSTEM, None, 8000, event="created"),
            L("kabir", "Welcome to the CSE 2027 batch group", 7990),
            L("simran", "Please keep this for academics only 🙏", 7980),
            L("kriti", "DSA lab submission is due on the 12th", 6000),
            L("ishita", "Is it extended? I haven't started 😬", 5995),
            L("kriti", "Nope, same deadline", 5990, reactions={"ishita": "😭"}),
            L("simran", "Prof. Gill uploaded the OS notes", 4000),
            L("tanvi", "Thanks! Can someone share the previous year papers?", 3995),
            L(
                "kabir",
                "Uploaded to the drive, link in the pinned doc",
                3990,
                reactions={"tanvi": "🙌"},
            ),
            L("rohan", "Mid-sem schedule is out, check the portal", 2000),
            L("sanyam", "OS paper on Monday, ugh", 1995),
            L("ishita", "At least DBMS is later", 1990),
            L("arjun", "Anyone has the DBMS lab manual?", 1200),
            L(
                "kriti",
                "Check the drive under 'Labs'",
                1195,
                quote="Anyone has the DBMS lab manual",
            ),
            L(
                "simran",
                "Placement talk tomorrow in the auditorium, 4 PM",
                600,
                reactions={"sanyam": "👍", "kriti": "👍"},
            ),
            L("kabir", "Bring your resumes, companies will be there", 595),
            L("tanvi", "Dress code is formal", 590),
            L("rohan", "Anyone going early to grab seats?", 150),
            L("arjun", "I'll be there by 3:30", 145),
            L("kriti", "Save one for me!", 140),
            L("ishita", "Saving two 😄", 135),
        ],
    ),
]
