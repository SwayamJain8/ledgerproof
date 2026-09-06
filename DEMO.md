# DEMO — bolne wali script

Ye padh ke tum **samajh** jaoge, phir bina ratte hue bol paoge.

Har section mein teen cheezein hain:
- 🖱️ **Karna kya hai** — kahan click
- 🗣️ **Bolna kya hai** — seedhe words
- 💡 **Peeche ka concept** — taaki sawaal aane pe atko nahi

---

# Shuru karne se pehle

```bash
npm run seed        # data wapas set
npm run dev         # app chalu
```

**Browser:** `/reports/integrity` khol ke rakho. **Dashboard se shuru NAHI karna.**
**Terminal:** ek tab khula rakho, `npm run check:chain` type karke rakho — Enter mat dabana.
**Login:** `adminuf` / `Admin@2026x`

---

# Sabse pehle — ek line jo poori pitch hai

> **"Is app ka har number ek hi table se aata hai — journal_item. Kuch bhi invoice ki list jod ke nahi banaya gaya."**

Agar aur kuch yaad na rahe, ye yaad rakhna. Poora architecture yahi hai.

💡 **Iska matlab kya hai:**
Zyadatar teams kya karti hain — Balance Sheet banane ke liye woh `invoices` table se `SUM(total)` kar leti hain, `bills` table se `SUM(total)` kar leti hain, aur report bana deti hain. Dikhne mein bilkul theek lagta hai.

Problem: **agar koi transaction invoice se nahi aaya to?** Malik ne apni jeb se paisa daala, ya kiraya diya, ya koi galti sudhaari — inka koi invoice nahi hota. Us system mein wo entry **kahin dikhegi hi nahi.**

Humne ulta kiya: har cheez pehle **ledger mein** jaati hai, aur report **ledger se** banti hai. Isliye jo bhi ho, report mein aayega.

---

# ACT 1 — Bharosa (60 second)

## Screen 1 · `/reports/integrity`

🖱️ Yahi page pehle se khula ho. Kuch click mat karo, bas dikhao.

🗣️ **Bolo:**

> "Main aapko kuch dikhaun uske pehle — ye system khud ko check kar raha hai. Terah checks, sab abhi ke abhi database se nikale gaye."

Ab teen pe ungli rakho:

> "**Total debit barabar total credit** — dus lakh terah hazaar ek sau bees, dono taraf.
>
> **Open invoices barabar Debtors account** — ye sabse strong hai. Yahan chhappan hazaar chaar sau ka number do bilkul alag raaston se aaya hai. Ek taraf documents se, doosri taraf ledger se. Dono ka jawab same hai.
>
> **P&L aur Balance Sheet ka profit same** — do alag report, ek hi jawab."

> "Ye maine likh ke nahi rakhe. Har check apna number us screen se **alag raaste** se nikalta hai jo use dikhati hai."

💡 **Concept:** Agar do alag tareeke se ek hi number aa raha hai, to wo number sach hai. Ek hi tareeke se aaye to bas ek calculation hai. **Isi ko cross-verification kehte hain**, aur asli auditor yahi karta hai.

---

## Screen 2 · `/reports/trial-balance`

🖱️ Sirf khol ke dikhao. 10 second.

🗣️ **Bolo:**

> "Accounting ka sabse purana check. Har rupya do jagah likha jata hai, dono side barabar honi chahiye. Agar ye match nahi karta, to baaki kisi number ka koi matlab nahi."

💡 **Concept:** Trial Balance koi report nahi hai jo malik dekhta ho. Ye **health check** hai — jaise doctor pehle pulse dekhta hai.

---

# ACT 2 — Business kaisa dikh raha hai (90 second)

## Screen 3 · `/` Dashboard

🖱️ Chaar card pe baari baari ungli.

🗣️ **Bolo:**

> "Ab ye chaar number matlab rakhte hain, kyunki aapne dekh liya ki books sahi hain.
>
> **Paanch lakh das hazaar** — bank aur cash milaake.
> **Chauvan hazaar chaar sau** — logon ne maal liya, paisa nahi diya.
> **Teis hazaar chhe sau** — humne maal liya, paisa nahi diya.
> **Battis hazaar profit** — ek lakh battis hazaar kamaya, ek lakh kharch hua."

> "In mein se kuch bhi store nahi hai. Har card ledger ka fresh calculation hai."

---

## Screen 4 · `/reports/balance-sheet` ⭐ **sabse important slide**

🖱️ Poori sheet dikhao. Dono total pe ungli.

🗣️ **Bolo:**

> "Paanch lakh unasi hazaar teen sau saath — dono taraf barabar."

Ab **Current Year Earnings ₹32,000** pe ungli rakho aur **ye line dhire se bolo:**

> "Ye account aisa hai jisme koi post nahi karta. Ye **compute** hota hai — income minus expenses — aur equity side mein daala jata hai.
>
> **Yahi wajah hai ki Balance Sheet balance karti hai.**
>
> Zyadatar submissions yahan ek number daal deti hain jo dono taraf barabar kar de. Aur pakdi jaati hain — kyunki jaise hi aap ek manual entry post karo, unki sheet hilti hi nahi."

🖱️ Ab **Debtors ₹54,400 pe click** karo → partner ledger → ek invoice → uski journal entry → payment.

🗣️ **Bolo:**

> "Har report ka har number clickable hai, neeche us entry tak jo usne banaya."

💡 **Concept — ye poori pitch ka dil hai:**

Accounting equation hai: **Assets = Liabilities + Capital**

Matlab: *jo kuch tumhare paas hai, wo kahin na kahin se aaya hai.* Ya to malik ne diya, ya udhaar liya, ya tumne kamaya.

Ab socho — saal mein ₹32,000 profit kamaya. **Wo profit kiska hai?** Malik ka. To wo **Capital side pe jayega**.

Agar tum profit ko equity mein nahi jodoge, to left side ₹32,000 zyada hoga aur sheet kabhi balance nahi hogi. Isliye log "plug figure" daalte hain — jhoota number.

Humare yahan wo **compute** hota hai. Isliye sach mein balance hota hai.

---

## Screen 5 · `/reports/profit-loss`

🗣️ **Bolo:**

> "Income ek lakh battis hazaar. Purchase assi hazaar, kiraya bees hazaar. Net **battis hazaar**.
>
> Wahi battis hazaar jo abhi Balance Sheet pe Current Year Earnings mein tha. Do alag report, alag alag bani, ek hi jawab."

💡 **Agar poochein "sabse mushkil kya tha?" — ye bolna:**

> "Ye dono report ek hi table se banti hain, lekin **do bilkul alag tarike se jodi jaati hain**.
>
> Balance Sheet **shuru se aaj tak** ka total leti hai — ek photo.
> P&L sirf **ek period** ka leti hai, aur account type ke hisaab se sign ulta karti hai — ek video.
>
> Ek hi table, do alag semantics, aur phir dono ka jawab match karana — Current Year Earnings se equation band karna. Yahin pe zyadatar log haar ke jhoota number daal dete hain."

---

# ACT 3 — Ye bharta kaise hai (2 minute)

## Screen 6 · `/journals` ⭐ **20 second ka sabse strong proof**

🗣️ **Pehle bolo:**

> "Sales journal ka default income account yahan hai."

🖱️ **Ab live karo:** usko badal do → naya invoice banao → uski entry kholo.

🗣️ **Bolo:**

> "Dekhiye — wo dusre account mein post hua.
>
> Maine code mein kahin bhi **'Sales Income' likha hi nahi hai.** Account configuration se resolve hota hai, post karte waqt. Yahi farak hai posting engine aur if-else ke dher mein."

🖱️ Wapas set kar do.

💡 **Concept:** Agar code mein account ka naam likha ho, to har naye customer ya product ke liye code badalna padega. Configuration se resolve hone ka matlab — **business apne rules khud badal sakta hai, developer ke bina.**

---

## Screen 7 · `/purchase-orders` → **PO0001** ⭐ live karna hai

🗣️ **Pehle ye bolo (click karne se pehle):**

> "Purchase Order ka matlab hai 'main ye maal khareedunga'. **Ledger mein kuch nahi jata.** Ye sirf vaada hai, transaction nahi."

🖱️ PO0001 kholo — **12 order kiye, 10 bill hue, 2 baaki**.

🗣️ **Bolo:**

> "Supplier ne baaraah mein se das bheje the, to bill bhi das ka hi bana. Do abhi baaki hain."

🖱️ **"Create bill" dabao** → **sirf 2 aayenge, ₹14,160** → Confirm.

🗣️ **Bolo:**

> "Order ka aadha bill karo, baaki khula rehta hai. Quantity har line pe track hoti hai, to supplier jitni baar deliver kare utni baar bill kar sakte ho."

> ⚠️ **Profit ₹32,000 se ₹20,000 ho jayega. Koi poochhe uske PEHLE bolo:**
>
> "Dhyan dijiye profit kam ho gaya. Ye sahi hai — **maal khareedna turant kharcha ban jata hai**, jaise hi bill aata hai. Jab wo maal bikega tab wapas aa jayega."

---

## Screen 8 · `/bills` → **BILL/2026/0001** → journal entry → **Explain**

🖱️ Entry pe pahuncho, lines dikhao:

```
Purchase Expense   Dr  60,000
Input GST          Dr  10,800
   Creditors           Cr  70,800
```

🗣️ **Bolo:**

> "Input GST **kharcha nahi hai** — wo **asset** hai. Kyunki wo GST sarkar se wapas milega, ya aage adjust hoga.
>
> Bahut saare log ise galti se expense mein daal dete hain, aur unka profit kam dikhta hai."

🖱️ Ab **Explain** dabao.

🗣️ **Bolo:**

> "Ye panel batata hai ki har account **kaunse rule se** aaya. Product ne apna account nahi bataya, to category dekhi gayi, wo bhi nahi thi, to Purchase journal ka default laga.
>
> Ye trace post karte waqt record hua tha — screen ke liye banaya nahi gaya."

🖱️ Ab `/bills` pe wapas — **dono bill dikhao**.

🗣️ **Bolo:**

> "Pehle bill pe **PO ka button hai**, doosre pe **nahi hai** — kyunki doosra seedha banaya gaya tha, kisi order se nahi. Ye spec ka rule hai."

---

## Screen 9 · `/invoices` — chaar invoice, chaar kahani

🖱️ List dikhao.

| Invoice | Kya dikhata hai |
|---|---|
| INV/0001 ₹61,360 **PAID** | Do line — 5 table + delivery |
| INV/0002 ₹70,800 **PARTIAL** | ⭐ ₹30,000 bank + ₹10,000 cash |
| INV/0003 ₹23,600 **NOT PAID** | Reconciliation ke liye |
| INV/0004 **CANCELLED** | ⭐⭐ Galti |

### INV/0001 pe

🗣️ **Bolo:**

> "Is invoice mein do line hain — paanch table aur delivery ka charge. GST **har line pe alag** nikla — nau hazaar aur teen sau saath — phir joda gaya.
>
> Total pe 18% lagate to shortcut hota. Jab rate alag ho ya rounding ho, tab galat aata hai. Sahi tarika per-line hai."

### INV/0002 pe ⭐

🗣️ **Bolo:**

> "Ye sattar hazaar aath sau ka hai. Tees hazaar bank se aaya, das hazaar **cash** se. **Ek invoice, do payment, do alag journal.** Tees hazaar aath sau abhi baaki hai.
>
> Zyadatar systems mein invoice pe ek `paid` ka true/false flag hota hai. Us design mein ye scenario **likha hi nahi ja sakta**.
>
> Humare yahan payment aur document ke beech allocation table hai jisme amount likha hota hai. Isliye **residual kahin store nahi hota** — har baar allocations se nikala jata hai. Isiliye 'Partial' yahan ek label nahi, asli cheez hai."

### INV/0004 pe ⭐⭐

🖱️ Kholo → uski entry → **reversal dikhao**.

🗣️ **Bolo:**

> "Ye galti se galat customer ke naam ban gaya tha.
>
> Is app mein **Edit button hai hi nahi. Delete button bhi nahi hai.**
>
> Galti sudharne ka tarika hai — **ulti entry post karo**. Bilkul mirror image. Dono entry hamesha ke liye books mein rehti hain, net asar zero, aur koi bhi dekh sakta hai ki kya hua tha.
>
> Accounting mein Delete button ek **fraud tool** hai — wo galti ke saath saboot bhi mita deta hai."

---

# ACT 4 — Sabse loud hissa (60 second)

## Screen 10 · `/reconcile` ⭐⭐ **isko bachaake rakhna, jaldi mat karna**

💡 **Pehle khud samjho:**

Bank ka statement **bahar se aata hai**. Bank ko tumhare invoice number se koi matlab nahi. Wo bas likh deta hai `NEFT/N PATHAK/INV-2026-0003` ya `UPI CR 16992`.

Reconciliation ka matlab: **har bank line dekh ke batana ki ye paisa kis invoice ka tha.** Asli dukaan mein accountant ye haath se karta hai, ghanton lagte hain.

🖱️ `demo/bank_statement_aug2026.csv` import karo.

| Line | Result |
|---|---|
| `NEFT/N PATHAK/INV-2026-0003` ₹23,600 | ✅ **100% auto** |
| `RTGS DR OPEN WOOD BILL-2026-0002` −₹23,600 | ✅ **100% auto** |
| `NEFT CR JOEY WILLS INV-2026-0002 PART` ₹20,000 | ⚠️ **77% — poochta hai** |
| `BANK CHARGES AUG QTR` −₹350 | ⬜ **kuch match nahi** |

🗣️ **Teen baatein, isi order mein:**

**1.** > "Pehli do dono **₹23,600** hain — ek aana, ek jaana. Ye kabhi invoice ko bill nahi samajhta, kyunki **direction pehle filter** karta hai, score karne se pehle."

**2.** > "Har point dikh raha hai — amount match se pachaas, reference se paintees, naam se bais, date se das. **Kuch guess nahi hai**, aur ispe unit tests likhe hue hain jo main abhi chalake dikha sakta hoon."

**3.** > "Teesri wali ye khud clear **nahi** karta, kyunki amount kam hai — ye part payment lag raha hai. **Confusion insaan ko deta hai, sikka nahi uchhalta.**
>
> Aur bank charges ka koi match nahi — to ye saaf bol deta hai 'koi match nahi', kisi ke saath jodta nahi."

🗣️ **Agar AI ka sawaal aaye:**

> "Matcher **jaan boojh ke deterministic** hai. AI sirf bache hue cases rank kar sakta hai — deterministic match ko kabhi override nahi karega, aur ledger mein kuch post to bilkul nahi karega. AI propose karta hai, insaan accept karta hai, engine post karta hai."

---

# ACT 5 — Closing (45 second)

## Screen 11 · `/reports/budget`

🗣️ **Bolo:**

> "Plan tha ek lakh, kharch hua assi hazaar — assi percent.
>
> Ye 'Achieved' **kahin store nahi hai**. Har baar ledger se joda jata hai — un journal items se jinpe 'Showroom Fitout' ka tag laga hai.
>
> Matlab agar main ek manual entry us tag ke saath post kar du, ye number **apne aap** badal jayega. Bills se nahi aa raha — ledger se aa raha hai."

---

## Screen 12 · Terminal ⭐⭐⭐ **sabse dhamakedar**

🖱️ Terminal pe switch karo, Enter dabao:

```bash
npm run check:chain
```

```
entry #4 BILL/2026/0002 — changing a debit of Rs. 20,000 to Rs. 99,999
  PASS  The chain now reports itself broken
        first break: entry #4    reason: HASH_MISMATCH
```

🗣️ **Bolo:**

> "Ye script abhi **seedha Postgres mein** ek posted row badal raha hai — append-only trigger **band karke**. Matlab jaise koi andar ka aadmi karta.
>
> Har entry pe **sha256 ka seal** hai — pichle entry ka hash plus apna content. Matlab har entry **poori history se bandhi hui hai**.
>
> Beech mein se chupke se kuch badal nahi sakte, kyunki uske baad ka har seal galat ho jayega. Aur ye batata hai ki **kaunsi entry** chhedi gayi.
>
> Odoo bhi yahi karta hai — fiscal compliance ke liye."

🖱️ Time ho to:

```bash
npm run audit    # 39 checks
npm test         # 78 tests
```

---

# ADMIN vs ACCOUNTANT (20 second)

🗣️ **Pehle principle bolo:**

> "Do role hain, aur farak asli hai — dikhawe ka nahi.
>
> **Accountant record karta hai ki kya hua. Admin wo rules set karta hai jinke andar accountant kaam karta hai.**"

🖱️ **Karke dikhao:**

1. Abhi `adminuf` se logged in ho → sidebar mein neeche **Settings** dikhao
2. Sign out → `priyaacc` / `Priya@2026x` se login
3. **Settings sidebar se gayab** → URL mein `/settings` type karo → **dashboard pe redirect**
4. Latest journal entry kholo → **"Reset to draft" button nahi hai**
5. Wapas admin se login → button aa gaya

🗣️ **Bolo:**

> "Ye sirf UI mein chhupaya nahi hai. **Page khud check karta hai**, isliye URL type karne se bhi kuch nahi milta."

🗣️ **Aur ye nuance bolo — isse pata chalta hai ki tumne system samjha hai:**

> "Reset to draft sirf **sabse nayi entry** pe kaam karta hai. Purani entry reversal se cancel hoti hai.
>
> Kyun? Kyunki har entry pichli entry ke hash se bandhi hai. **Beech se ek entry nikaal do to uske baad ka har seal aise cheez ko point karega jo wahan hai hi nahi.**
>
> Ye rule humne decide nahi kiya — ye design se apne aap nikla."

| | **Admin** `adminuf` | **Accountant** `priyaacc` |
|---|---|---|
| Transaction record karna | ✅ | ✅ |
| Master data banana | ✅ | ✅ |
| Saari reports | ✅ | ✅ |
| **Settings** | ✅ | ❌ sidebar mein bhi nahi |
| **Reset to draft** | ✅ | ❌ button hi nahi |

---

# Sawal jo pakka aayenge

**"Hardcode kiya hai kya?"**
> "Kisi bhi entry pe Explain dabaiye, rule ka naam likha hai. Ya Journals mein jaake default account badal dijiye aur naya invoice banaiye — wo dusre account mein jayega."

**"Balance Sheet sach mein balance hoti hai?"**
> "Paanch lakh unasi hazaar teen sau saath, dono taraf. Jod ke dekh lijiye. Aur Current Year Earnings compute hota hai, store nahi."

**"Aadha payment kaise handle karte ho?"**
> "INV/2026/0002 dekhiye — sattar hazaar aath sau ka, tees hazaar bank se aur das hazaar cash se aaya. Ek invoice, do payment, do journal. Residual allocations se nikalta hai, koi flag nahi hai."

**"Posted invoice edit kar sakte ho?"**
> "Edit button hai hi nahi. Cancel karne pe ulti entry banti hai, dono books mein rehti hain."

**"Postgres kyun, Mongo kyun nahi?"**
> "Double entry ke liye multi-row transaction chahiye, aur ek CHECK constraint jo debit=credit force kare. Uske bina 'balanced' sirf umeed hai, guarantee nahi."

**"Do log ek saath post karein to?"**
> "Document numbering row lock leti hai, hash chain advisory lock leti hai. Isliye posts serialise ho jaate hain. Numbering mein gap nahi aa sakta — aur gap wahi cheez hai jo auditor sabse pehle poochta hai."

**"Sabse mushkil kya tha?"**
> "Balance Sheet aur P&L ko ek hi table se do alag tarike se jodna, aur phir dono ka jawab match karana."

**"Aage kya banate?"**
> "GST return export — GSTR-1 aur 3B. Proper inventory with COGS matching, taaki maal khareedne se profit kam na dikhe. Aur multi-currency."

---

# Ye kabhi mat bolna

- ❌ "Wo part demo ke liye hardcode hai"
- ❌ "Time nahi mila"
- ❌ "Shayad aisa hota hai" / "I think"
- ❌ Master data se demo shuru karna
- ❌ Camera pe form bharna (sirf PO→Bill exception hai)

---

# Numbers jo ratne hain

| | |
|---|---|
| Total assets | **₹5,79,360** (dono taraf) |
| Net profit | **₹32,000** |
| Malik ne daala | **₹5,00,000** |
| Books | **35 items, 13 entries** |
| Trial balance | **₹10,13,120** dono taraf |
| Log denge (Debtors) | **₹54,400** |
| Humein dena hai (Creditors) | **₹23,600** |
| Budget | ₹1,00,000 plan, ₹80,000 kharch, **80%** |

**Live demo mein profit ka safar:**
```
Shuru              ₹32,000
PO → Bill ke baad  ₹20,000    (maal khareeda, kharcha turant)
SO → Invoice baad  ₹50,000    (becha, wapas aa gaya)
```

---

# Timing

| Time | Screen |
|---|---|
| 0:00–0:40 | Books Integrity — 13 checks |
| 0:40–1:20 | Balance Sheet — Current Year Earnings + drill-down |
| 1:20–1:50 | Journals — default badlo, post karo |
| 1:50–2:40 | PO → Create bill (partial) → Explain |
| 2:40–3:20 | Invoices — PARTIAL, phir cancelled wala |
| 3:20–4:15 | **Reconcile — sabse loud** |
| 4:15–4:45 | Terminal — `check:chain` |
| 4:45–5:00 | Admin vs Accountant |

---

# Kuch bigad jaye to

```bash
npm run seed && npm run audit
```

Pandrah second. Ghabrana nahi — **ye line bol dena:**

> "Ek second, main data reset kar deta hoon — pandrah second lagenge, aur ye khud dikha dega ki books tie out ho rahi hain."

Reset hona bhi ek **feature** lagta hai, bug nahi.

---

# Aakhri baat

Agar sab bhool jao, to bas ye bol dena:

> **"Is app ka har number ek hi immutable table se derive hota hai. Kuch bhi invoice list se jod ke nahi banaya. Aur main abhi database mein jaake ek row badal ke dikha sakta hoon ki system pakad leta hai."**

Bas. Wahi poori kahani hai.
