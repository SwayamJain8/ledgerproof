# Har screen, gehraai se — LedgerProof

Ye document technical nahi hai. Ye **concept** ka hai — har screen *kyun* hai,
business mein wo cheez *kya* hoti hai, aur judge ko *kya* bolna hai.

Har number yahan **live database se verify kiya hua hai**.

---

# Pehle: poora system ek paragraph mein

Ek furniture ki dukaan hai. Wo maal khareedti hai, bechti hai, paise deti-leti hai.
Har mahine malik ko teen sawaal ka jawab chahiye:

1. **Mere paas kya hai, aur kiska kitna dena-lena hai?** → Balance Sheet
2. **Is saal kamaya ya gawaaya?** → Profit & Loss
3. **Jo socha tha utna hi kharch hua?** → Budget

Poore app ka ek hi asli kaam hai: **har transaction ko ek hi jagah, ek hi tarike se
likhna** — taaki ye teeno report *apne aap* nikal aayein, kisi ne unhe alag se type
na kiya ho.

Wo "ek jagah" hai **journal_item** table. Aur yahi tumhari poori pitch hai.

---

# Sabse pehle ye samjho: Double Entry

### Har transaction do jagah likha jata hai

Socho tum ₹40,000 ki chairs **cash mein** becho. Do cheezein ek saath hui:

- Tumhare paas **cash aaya** (+₹40,000)
- Tumne **income kamaya** (+₹40,000)

Ek hi ghatna, do pehlu. Isliye accounting mein ise **do lines** mein likhte hain:

```
Cash A/c            Debit   40,000     <- ye mila
Sales Income A/c    Credit  40,000     <- iski wajah se mila
```

### Debit aur Credit ka asli matlab

School wali definition bhool jao. Practical matlab ye hai:

| | Debit ka matlab | Credit ka matlab |
|---|---|---|
| **Asset** (cash, bank, jo log tumhe denge) | Badha 📈 | Ghata 📉 |
| **Liability** (jo tumhe dena hai) | Ghata | Badha |
| **Income** | — | Badha |
| **Expense** | Badha | — |
| **Capital** (malik ka paisa) | Ghata | Badha |

**Golden rule:** *Debit total = Credit total, hamesha.* Agar barabar nahi, to entry
galat hai — aur ye app usse **save hi nahi karne dega**.

### Ye rule kyun bana

Isliye ki **galti chhup na sake**. Agar ek taraf likha aur doosri bhool gaye, to
total match nahi karega aur turant pata chal jayega. 500 saal purana system hai,
aur aaj bhi duniya ka har accounting software isi pe chalta hai.

> **Judge ko bolna:** *"Har entry do taraf likhi jati hai aur dono taraf barabar
> honi chahiye. Ye rule maine code mein nahi, database mein daala hai — ek CHECK
> constraint. Matlab agar koi script mera code bypass karke seedha database mein
> galat entry daalne ki koshish kare, Postgres usse mana kar dega."*

---

# Accounting Equation — poori app ka dil

```
Assets  =  Liabilities  +  Capital
(jo hai)   (jo dena hai)   (malik ka)
```

Ye hamesha barabar rehta hai. Kyun? Kyunki **jo kuch bhi tumhare paas hai, wo
kahin na kahin se aaya hai** — ya to udhaar (liability), ya malik ne dala (capital),
ya tumne kamaya (profit).

### Aur yahi wo jagah hai jahan 90% teams fail hoti hain

Agar tumne saal mein ₹32,000 profit kamaya, wo profit **kahan gaya?**

Wo **Capital side pe jayega** — kyunki profit malik ka hi hai. Isko
**Current Year Earnings** kehte hain.

**Agar tum profit ko equity side mein nahi jodoge, to Balance Sheet kabhi balance
nahi hogi.** Zyadatar teams yahan ek "plug figure" daal deti hain — koi bhi number
jo dono taraf barabar kar de. Aur pakde jaati hain, kyunki manual entry post karte
hi unki sheet hil jaati hai.

Humare yahan Current Year Earnings **koi account nahi hai jahan koi post karta ho** —
wo **compute** hota hai: Income − Expenses. Isliye balance hota hai.

> **Judge ko bolna:** *"Current Year Earnings ₹32,000 — ye kisi ne post nahi kiya.
> Ye P&L ka net income hai jo equity side mein inject hota hai. Yahi wajah hai ki
> Balance Sheet balance karti hai."*

---

# Demo Data — asli kahani, asli calculation

**Urban Furniture, Ahmedabad. FY 2026–27 ke pehle chaar mahine.**
**13 journal entries. Bas. Sab kuch samajh mein aa jayega.**

---

### 1 Apr — Malik dukaan shuru karta hai

Apne ₹5,00,000 daalta hai: ₹4,50,000 bank mein, ₹50,000 cash rakh leta hai.

```
Bank A/c       Dr  4,50,000
Cash A/c       Dr    50,000
  Capital A/c      Cr  5,00,000
```

**Asal mein kya hua:** Malik ne apni jeb se paisa dukaan ko diya. Dukaan ke liye
ye *udhaar* hai — isliye Capital (liability jaisa) badha, aur Bank/Cash (asset) badha.

**Isko manual entry se kyun kiya?** Kyunki iska koi bill ya invoice nahi hota.
Aur yahi wo entry hai jo sabit karti hai ki reports invoice table se nahi banti.

---

### 10 Apr — 12 tables ka order

**PO0001** → Azure Furniture ko: 12 Wooden Table @ ₹6,000 = ₹72,000 + GST 18% ₹12,960 = **₹84,960**

```
Koi journal entry NAHI BANI.
```

**Kyun nahi?** Kyunki **order sirf ek vaada hai, transaction nahi.** Tumne abhi
kuch khareeda nahi — sirf bola ki khareedunga. Na maal aaya, na paisa gaya.

> **Judge ko bolna:** *"PO confirm karne pe ledger mein kuch nahi jata. Ye jaan
> boojh ke hai — order ek commitment hai. Ledger tab hilta hai jab bill aata hai."*

---

### 18 Apr — Sirf 10 tables aaye

Supplier ne 12 mein se 10 bheje. To bill bhi 10 ka hi banega.

**10 × ₹6,000 = ₹60,000** · GST 18% = **₹10,800** · Dena hai **₹70,800**

```
Purchase Expense A/c   Dr  60,000
Input GST A/c          Dr  10,800
  Creditors A/c            Cr  70,800
```

**Har line ka matlab:**

- **Purchase Expense ₹60,000** — maal ka kharcha
- **Input GST ₹10,800** — ye kharcha *nahi* hai! Ye sarkar se **wapas milega**
  (ya aage GST bharte waqt adjust hoga). Isliye ye **Asset** hai, expense nahi.
- **Creditors ₹70,800** — Azure ka humpe udhaar

**PO ab bhi khula hai — 2 tables baaki.** Iska matlab ek order ko tukdon mein bill
kar sakte ho, jaise supplier deliver karta jaye.

> **Judge ko bolna:** *"Input GST expense nahi hai — wo asset hai, kyunki sarkar
> se wapas milega. Bahut saare log ise galti se expense mein daal dete hain aur
> unka profit kam dikhta hai."*

---

### 25 Apr — Azure ko poora paisa diya (Bank se)

```
Creditors A/c   Dr  70,800
  Bank A/c          Cr  70,800
```

**Dhyaan do — yahan koi expense nahi hai.** Kharcha to 18 Apr ko hi ho chuka tha
jab bill aaya. Aaj sirf **udhaar chukaya** — ek liability khatam hui, bank kam hua.

Bank: 4,50,000 − 70,800 = **₹3,79,200**

> **Ye concept important hai:** *kharcha tab hota hai jab bill banta hai, paisa
> dene pe nahi.* Isko **accrual accounting** kehte hain.

---

### 5 May — Bina PO ke chairs khareede

Dukaan pe hi 20 Office Chair @ ₹1,000 = ₹20,000 + GST ₹3,600 = **₹23,600**

**Ye bill abhi tak nahi diya.** Isliye Creditors mein ₹23,600 khada hai.

**Aur iske peeche koi PO nahi hai** — isliye is bill pe **PO ka button nahi
dikhega**, jabki 18 Apr wale bill pe dikhega. Ye spec ka conditional-visibility
rule hai.

---

### 12 May — Pehli bikri (do line wala invoice) ⭐

Nimesh Pathak: **5 tables @ ₹10,000** + **delivery ₹2,000**

| Line | Amount | GST 18% |
|---|---|---|
| 5 × Wooden Table | ₹50,000 | ₹9,000 |
| Delivery Charge | ₹2,000 | ₹360 |
| **Total** | **₹52,000** | **₹9,360** |

**Invoice total = ₹61,360**

```
Debtors A/c        Dr  61,360
  Sales Income A/c     Cr  52,000
  Output GST A/c       Cr   9,360
```

**Ye line worth pointing at hai:** GST **har line pe alag** nikala gaya — ₹9,000
aur ₹360 — phir jodá gaya. Agar total pe 18% lagate to bhi ₹9,360 hi aata, lekin
jab rates alag ho ya rounding ho tab farak padta hai. **Sahi tarika per-line hai.**

**Output GST kya hai?** Customer se GST *tumne* wasoola hai, wo tumhara nahi —
**sarkar ka hai**. Isliye wo **Liability** hai.

> **Judge ko bolna:** *"Delivery ek service product hai — uska koi stock nahi
> hota. Aur GST per-line compute hota hai, document total pe nahi. Ye Taxes page
> pe likha bhi hai, aur ye invoice usse prove karta hai."*

---

### 25 May — Nimesh ne poora ₹61,360 diya (Bank)

```
Bank A/c        Dr  61,360
  Debtors A/c       Cr  61,360
```

**Phir se: yahan koi income nahi hai.** Income to 12 May ko hi ban gayi thi.
Aaj sirf udhaar wasool hua.

---

### 10 Jun — Joey Wills ko 2 sofe (bina sales order)

2 × ₹30,000 = ₹60,000 + GST ₹10,800 = **₹70,800**

Seedha invoice banaya — koi sales order nahi. Isliye is invoice pe **SO ka button
nahi dikhega**.

---

### 28 Jun — Joey ne sirf ₹30,000 diye (Bank)
### 15 Jul — Aur ₹10,000 cash mein diye ⭐⭐

```
Bank A/c   Dr  30,000        Cash A/c   Dr  10,000
  Debtors      Cr  30,000      Debtors      Cr  10,000
```

**Baaki: 70,800 − 30,000 − 10,000 = ₹30,800** → badge **PARTIAL**

**Ye sabse important scenario hai.** Ek invoice, **do alag payment**, **do alag
journal** (Bank aur Cash).

**Zyadatar systems mein invoice pe ek `paid = true/false` flag hota hai.** Us
design mein ye scenario likha hi nahi ja sakta. Humare yahan payment aur document
ke beech **allocation table** hai jisme amount likha hota hai — isliye ek invoice
ko chaar log alag-alag kist mein bhar sakte hain.

> **Judge ko bolna:** *"Residual kahin store nahi hota. Har baar allocations se
> nikala jata hai. Isliye 'Partial' yahan ek label nahi — asli cheez hai."*

---

### 5 Jul — Ek invoice jaan boojh ke khula chhoda

Nimesh: 10 chairs @ ₹2,000 = ₹20,000 + GST ₹3,600 = **₹23,600** — **unpaid**

Ye wahi invoice hai jise bank reconciliation demo mein settle karenge.

---

### 20 Jul — Galti, aur usko sudharne ka sahi tarika ⭐⭐⭐

Galti se Joey ke naam ₹35,400 ka invoice bana diya (1 sofa). Ab kya karein?

**Delete nahi kar sakte. Edit nahi kar sakte.**

Iski jagah **ulta entry** post hoti hai — bilkul mirror image:

```
ASLI ENTRY (INV/2026/0004)          ULTI ENTRY (RINV/2026/0004)
Debtors      Dr  35,400              Sales Income   Dr  30,000
  Sales Income   Cr  30,000          Output GST     Dr   5,400
  Output GST     Cr   5,400            Debtors          Cr  35,400
```

**Dono entries hamesha ke liye books mein rehti hain.** Net asar zero, lekin
koi bhi dekh sakta hai ki kya hua tha aur kaise theek kiya gaya.

Aur invoice ka status **CANCELLED** ho jata hai — taaki wo "pending payment"
wali list se nikal jaye.

> **Judge ko bolna:** *"Accounting mein Delete button ek fraud tool hai — wo galti
> ke saath saboot bhi mita deta hai. Isliye yahan Edit aur Delete hai hi nahi.
> Galti sudharne ka tarika hai ulti entry — dono books mein rehti hain."*

---

### 31 Jul — Dukaan ka kiraya ₹20,000 (cash)

```
Other Expense A/c   Dr  20,000
  Cash A/c              Cr  20,000
```

Ye **Other Expense** hai — maal ka kharcha nahi. Isliye P&L mein alag line pe
dikhta hai.

---

## Final books — sab jodne ke baad

| **Assets** (jo hai) | | **Liabilities + Capital** (kiska hai) | |
|---|---|---|---|
| Bank | ₹4,70,560 | Creditors (Open Wood ka udhaar) | ₹23,600 |
| Cash | ₹40,000 | Output GST (sarkar ka) | ₹23,760 |
| Debtors (log denge) | ₹54,400 | Capital (malik ka) | ₹5,00,000 |
| Input GST (sarkar dega) | ₹14,400 | **Current Year Earnings** | **₹32,000** |
| **Total** | **₹5,79,360** | **Total** | **₹5,79,360** |

**Debtors ₹54,400** = Joey ka bacha ₹30,800 + Nimesh ka khula ₹23,600 ✓

**Profit & Loss:**
```
Income                    1,32,000
  Purchase Expense         -80,000     (60,000 + 20,000)
  Other Expense (rent)     -20,000
                          ─────────
Net Income                  32,000     <- wahi jo Balance Sheet pe hai
```

---

# Ab har screen — kya hai aur kyun hai

---

## 🏠 Dashboard — `/`

**Kya hai:** Chaar number jo har baar page khulne pe ledger se dobara nikale jate hain.

| Card | Value | Matlab |
|---|---|---|
| Money we hold | ₹5,10,560 | Bank + Cash |
| Customers owe us | ₹54,400 | Logon ne maal liya, paisa nahi diya |
| We owe suppliers | ₹23,600 | Tumne maal liya, paisa nahi diya |
| Profit so far | ₹32,000 | Kamaya minus kharcha |

> **Bolna:** *"Yahan kuch bhi store nahi hai. Har card ledger ka fresh calculation hai."*

---

## 📗 Chart of Accounts — `/accounts`

**Concept:** Har paisa kisi na kisi "dabbe" mein jata hai. Ye dabbon ki list hai.

**Paanch type hote hain:**

| Type | Matlab | Example |
|---|---|---|
| **Asset** | Jo tumhare paas hai / milega | Bank, Cash, Debtors, Input GST |
| **Liability** | Jo tumhe dena hai | Creditors, Output GST |
| **Capital** | Malik ka hissa | Capital, Current Year Earnings |
| **Income** | Kamai | Sales Income |
| **Expense** | Kharcha | Purchase Expense, Other Expense |

**Sabse important baat:** Report **naam se nahi, TYPE se** chalti hai. Balance
Sheet Asset/Liability/Capital padhti hai. P&L Income/Expense padhti hai.

> **Bolna:** *"Main kisi bhi account ka naam badal du, koi report nahi tootegi —
> kyunki reports type dekhti hain, naam nahi."*

---

## 📓 Journals — `/journals`

**Concept:** Purane zamane mein alag-alag **bahi khaate** hote the — bikri ka alag,
kharid ka alag, bank ka alag. Wahi cheez hai.

Chaar hain: **Sales, Purchase, Bank, Cash.**

Har journal ke saath ek **default account** juda hai. Sales journal ka default
Sales Income hai.

**⭐ Ye tumhara sabse strong 20 second hai.** Yahan default account badal do,
phir naya invoice banao — wo naye account mein post hoga. **Bina code change kiye.**

> **Bolna:** *"Yahi farak hai posting engine aur if-else ke dher mein. Maine kahin
> 'Sales Income' likha hi nahi — wo configuration se resolve hota hai."*

---

## 👥 Contacts — `/contacts`

**Concept:** Jisse bhi tum kuch khareedte ya bechte ho. Customer, Vendor, ya dono.

Kyun ek hi table? Kyunki asli duniya mein ek hi banda dono ho sakta hai — tum
usse maal bhi becho aur usse service bhi lo.

**List aur Kanban** dono view hain (spec dono maangta hai).

---

## 📦 Products — `/products`

**Concept:** Jo tum bechte/khareedte ho. Har product ka bechne ka rate aur
khareedne ka rate.

**Yahan ki khaas baat:** har product apna income/expense account bata *sakta* hai,
par zaroori nahi. Agar nahi bataya to:

```
Product ka account?  → nahi hai
  ↓
Category ka account? → nahi hai
  ↓
Journal ka default   → Sales Income ✓
```

Isko **resolution chain** kehte hain. Aur har entry ke saath likha jata hai ki
**kaunsa step kaam aaya** — wahi "Explain" panel dikhata hai.

---

## 🏷️ Analytic Accounts — `/analytics`

**Concept:** Ye samajhna thoda mushkil hai, dhyan se.

Chart of Accounts batata hai **"kis kism ka kharcha"** — jaise "Purchase Expense".

Analytic Account batata hai **"kis kaam ke liye"** — jaise "Showroom Fitout".

**Example:** ₹60,000 ka table khareeda.
- Chart of Accounts: *Purchase Expense* (ye maal ka kharcha hai)
- Analytic: *Showroom Fitout* (ye showroom sajane ke liye tha)

Dono alag sawaal ke jawab hain. Isi wajah se budget bana sakte ho — "showroom
sajane pe ₹1,00,000 se zyada nahi kharch karunga", chahe wo paisa kisi bhi
expense account se jaye.

---

## 🎯 Budgets — `/budgets` aur `/reports/budget`

**Concept:** Plan banao, phir dekho kitna kharch hua.

```
Showroom Fitout Q1
Committed (plan)   1,00,000
Achieved (actual)     80,000     <- dono vendor bills
Baaki                 20,000
                          80%
```

**⭐ Sabse important baat:** "Achieved" **kahin store nahi hota**. Har baar page
kholne pe **ledger se joda jata hai** — un journal items se jinpe "Showroom
Fitout" ka tag laga hai.

Iska matlab: agar tum ek manual entry us tag ke saath post kar do, ye number
**apne aap** badal jayega.

> **Bolna:** *"Achieved bills se nahi, journal items se aata hai. Isliye manual
> entry ya reversal bhi ise hilata hai."*

**Aur ek cheez:** budget **Revise** kar sakte ho. Wo purana budget edit nahi karta —
**naya record banata hai**, purane ko "Revised" mark karta hai, aur dono ko jod
deta hai. Kyunki pichle quarter ka plan bhi record hai, use mitana nahi chahiye.

---

## 🛒 Purchase Orders — `/purchase-orders`

**Concept:** "Main ye maal khareedunga" — sirf vaada.

**PO0001: 12 ordered, 10 billed, 2 baaki.**

**Ledger mein kuch nahi jata.** Ye baar-baar bolna — log samajhte nahi ki order
transaction nahi hota.

**⭐ Live karo:** "Create bill" dabao → sirf **bache hue 2** aa jayenge.

---

## 🧾 Vendor Bills — `/bills`

**Concept:** "Supplier ne paisa maanga hai."

| Bill | Vendor | Amount | Status | PO se aaya? |
|---|---|---|---|---|
| BILL/2026/0001 | Azure Furniture | ₹70,800 | **PAID** | ✅ haan |
| BILL/2026/0002 | Open Wood | ₹23,600 | **NOT PAID** | ❌ nahi |

**Status badge compute hota hai**, kabhi haath se set nahi hota.

---

## 💸 Payments — `/payments/send` · `/payments/receive`

**Concept:** Paisa aana-jaana. Bas.

**Yaad rakho:** payment kabhi income ya expense ko nahi chhuta. Wo sirf **udhaar
ghatata hai**.

- Customer se paisa aaya → Bank badha, Debtors ghata
- Vendor ko diya → Creditors ghata, Bank ghata

---

## 📄 Customer Invoices — `/invoices`

| Invoice | Customer | Amount | Baaki | Status |
|---|---|---|---|---|
| INV/2026/0001 | Nimesh | ₹61,360 | ₹0 | PAID |
| INV/2026/0002 | Joey | ₹70,800 | **₹30,800** | **PARTIAL** |
| INV/2026/0003 | Nimesh | ₹23,600 | ₹23,600 | NOT PAID |
| INV/2026/0004 | Joey | ₹35,400 | — | **CANCELLED** |

Char invoice, char alag kahani: poora paid, aadha paid, bilkul unpaid, aur cancel.

---

## 📚 Journal Entries — `/journal-entries`

**Concept:** **Ye asli ledger hai.** Baaki sab screens iske aage ka mukhauta hain.

Har confirmed invoice, bill, payment yahan ek balanced entry banke aata hai.
**Aur koi raasta nahi hai** ki koi number books mein ghuse.

**⭐ Kisi bhi entry pe "Explain" dabao** — dikhega ki har account kis rule se aaya.

> **Bolna:** *"Ye panel 'tumne hardcode kiya kya?' ka jawab hai. Ye post karte
> waqt record hota hai, screen ke liye banaya nahi jata."*

**Aur yahan se manual entry bhi post kar sakte ho** — wahi jo malik ke capital
ke liye ki thi.

---

## 🏦 Bank Reconciliation — `/reconcile` ⭐⭐

**Concept — pehle ye samjho:**

Bank ka statement **bahar se aata hai**. Bank ko tumhare invoice number ka kuch
pata nahi. Wo bas likhta hai `NEFT/N PATHAK/INV-2026-0003` ya `UPI CR 16992`.

**Reconciliation ka matlab:** har bank line dekh ke batana ki *ye paisa kis
invoice ka hai*.

Asal dukaan mein accountant ye haath se karta hai — ghanton lagte hain.

**Humara matcher chaar cheezein dekhta hai:**

| Signal | Points | Matlab |
|---|---|---|
| Amount exactly match | +50 | Sabse strong |
| Narration mein invoice number | +35 | Bank ne reference likha |
| Partner ka naam milta hai | +22-30 | "PATHAK" ↔ "Nimesh Pathak" |
| Date paas hai | +10 | 60 din ke andar |

**85% se upar aur runner-up se 12 point aage → apne aap match.**
Warna **insaan se poochta hai.**

**Demo file (4 lines):**

| Line | Result |
|---|---|
| `NEFT/N PATHAK/INV-2026-0003` ₹23,600 | ✅ **100% auto** |
| `RTGS DR OPEN WOOD BILL-2026-0002` −₹23,600 | ✅ **100% auto** |
| `NEFT CR JOEY WILLS INV-2026-0002 PART` ₹20,000 | ⚠️ **77% — poochta hai** |
| `BANK CHARGES AUG QTR` −₹350 | ⬜ **kuch match nahi** |

**Teen baatein bolni hain:**

1. *"Pehli do dono ₹23,600 hain — ek aana, ek jaana. Ye kabhi invoice ko bill
   nahi samajhta, kyunki direction pehle filter karta hai."*
2. *"Har point dikhta hai — kaunse signal se kitna mila. Kuch guess nahi hai,
   aur ispe unit tests hain."*
3. *"Teesri wali ye khud clear nahi karta kyunki amount kam hai. Confusion insaan
   ko deta hai, sikka nahi uchhalta."*

> **AI ka sawaal aaye to:** *"Matcher jaan boojh ke deterministic hai. AI sirf
> bache hue cases rank kar sakta hai — deterministic match ko kabhi override
> nahi karega, aur kuch post to bilkul nahi karega."*

---

## 📊 Reports

### Trial Balance — `/reports/trial-balance`
Sabse bunyadi check: **total debit = total credit**. ₹10,13,120 dono taraf.
Agar ye match nahi karta, kuch bhi bharosa layak nahi.

### Balance Sheet — `/reports/balance-sheet`
**Ek din ki photo.** Aaj ki tareekh ko kya hai aur kiska hai.

Har number pe click karke andar ja sakte ho — Debtors → kis customer ka → kaunsa
invoice → kaunsi entry → kaunsa payment.

### Profit & Loss — `/reports/profit-loss`
**Ek period ki video.** Apr se aaj tak kya kamaya, kya kharcha.

> **Ye line important hai:** *"Balance Sheet aur P&L — dono ek hi table se bante
> hain, lekin do bilkul alag tarah se jode jate hain. Balance Sheet shuru se aaj
> tak ka total leta hai. P&L sirf ek period ka, aur type ke hisab se ulta sign
> lagata hai. Yahi is project ka sabse mushkil hissa tha."*

---

## 🔒 Books Integrity — `/reports/integrity` ⭐⭐⭐

**Demo yahin se shuru karo. Dashboard se nahi.**

**13 checks, sab live nikale hue:**

| Check | Kya sabit karta hai |
|---|---|
| Debit = Credit | Bunyadi rule |
| Har entry apne aap mein balanced | Koi entry akele bhi sahi hai |
| Koi item negative ya do-tarfa nahi | Ganda data nahi hai |
| Har posted document ki entry hai | Koi document engine bypass nahi kiya |
| Har entry pe resolution trace hai | Hardcode nahi hai |
| **Open invoices = Debtors account** | ⭐ Do bilkul alag raaste, ek hi number |
| **Open bills = Creditors account** | ⭐ Wahi purchase side pe |
| Residual derive hota hai | Koi paid/unpaid flag nahi |
| Assets = Liabilities + Capital | Equation band hai |
| **P&L aur Balance Sheet ka profit same** | ⭐ Do report, ek hi jawab |
| **Hash chain toota nahi** | ⭐ Koi cheda nahi |
| Har entry sealed hai | Koi entry chain ke bahar nahi |

> **Bolna:** *"Ye assertions maine type nahi ki. Har check apna number us screen
> se alag raaste se nikalta hai jo use dikhati hai. Subledger wale sabse strong
> hain — documents aur ledger bilkul alag raaste se ₹54,400 pe pahunchte hain."*

---

# Teen "proof" moments

### Proof 1 — Manual entry post karo, Balance Sheet hilti hai

`Dr Cash 50,000 / Cr Capital 50,000` → sheet turant badal jayegi.

*"Jo system apni reports invoice list se jodta hai, wo ye kar hi nahi sakta —
uske paas is entry ke liye jagah hi nahi hai."*

### Proof 2 — Balance rule todne ki koshish karo

Aisi entry banao jisme debit ≠ credit. **Post button enable hi nahi hoga.**
Aur agar screen bypass bhi kar lo, database ka CHECK constraint mana kar dega.

### Proof 3 — Database mein hi cheda karo ⭐⭐⭐

```bash
npm run check:chain
```

Ye **seedha Postgres mein posted row badalta hai**, triggers band karke —
matlab jaise koi insider karta. Phir chain verify karta hai:

```
first break: entry #4 (BILL/2026/0002)
reason:      HASH_MISMATCH
```

phir wapas theek kar deta hai.

*"Trigger app ko rokta hai. Database console wale ko nahi rokta. Isliye har entry
pe sha256 ka seal hai — pichle hash + apna content. Har entry poori history se
bandhi hui hai. Beech mein se chupke se kuch badal nahi sakte. Odoo bhi yahi
karta hai, fiscal compliance ke liye."*

---

# Terminal proofs — 30 second

```bash
npm run audit            # 39 checks, alag se likhe hue. Books tie out.
npm test                 # 78 unit tests
npm run check:chain      # DB mein cheda karo, pakda jata hai
npm run check:orders     # PO -> partial bill -> baaki
npm run check:reconcile  # bank statement score karo bina settle kiye
```

---

# Sawal jo aayenge

**"Hardcode kiya hai kya?"**
Nahi — kisi bhi entry pe Explain dabao, rule ka naam likha hai. Ya Sales journal
ka default account badal ke naya invoice banao.

**"Balance Sheet sach mein balance hoti hai?"**
₹5,79,360 dono taraf. Jod ke dekh lo. Aur Current Year Earnings compute hota hai,
store nahi.

**"Posted invoice edit kar sakte ho?"**
Edit button hai hi nahi. Cancel karne pe ulti entry banti hai, dono books mein
rehti hain.

**"Aadha payment kaise handle karte ho?"**
INV/2026/0002 dekho — ₹70,800 ka, ₹30,000 bank se aur ₹10,000 cash se aaya,
₹30,800 baaki. Ek invoice, do payment, do journal.

**"Postgres kyun, Mongo kyun nahi?"**
Double entry ke liye multi-row transaction chahiye aur ek CHECK constraint jo
debit=credit force kare. Uske bina "balanced" sirf umeed hai, guarantee nahi.

**"Sabse mushkil kya tha?"**
Balance Sheet aur P&L ko ek hi table se **do alag tarike se** jodna, aur phir
dono ka jawab match karana. Current Year Earnings se equation band karna — yahin
zyadatar log haar ke plug figure daal dete hain.

**"Aage kya banate?"**
GST return export (GSTR-1/3B), proper inventory with COGS matching, multi-currency.

---

# Ye kabhi mat bolna

- ❌ *"Wo part demo ke liye hardcode hai."*
- ❌ *"Time nahi mila."*
- ❌ Demo master data se shuru mat karna. **Books Integrity se shuru karo.**
- ❌ Camera pe form mat bharna — sirf PO/SO conversion ke waqt.

---

# Kuch bigad jaye to

```bash
npm run seed && npm run audit
```

Pandrah second, aur tum wapas is page pe ho.
