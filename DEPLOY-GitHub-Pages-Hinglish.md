# GitHub Pages pe Deploy, Step by Step (Hinglish)

Ye app **pure browser** mein chalti hai, isliye **GitHub Pages** pe free host hoti hai.
Koi Render, koi Python server nahi. AI calls seedha tumhare browser se OpenRouter ko
jaati hain.

## PART A, OpenRouter key lo
1. Kholo: **https://openrouter.ai** , sign in (Google se ho jaata hai).
2. Left menu mein **Keys** , **Create Key** , naam do , **Create**.
3. Key (`sk-or-...`) copy karke safe rakho. (Note: OpenRouter ke kuch models free hain,
   kuch paid. Paid use karna ho toh thoda credit add kar lena, Settings , Credits.)

## PART B, Files GitHub pe daalo
1. **https://github.com** , Sign in , upar-right **+** , **New repository**.
2. Naam do (jaise `bmb-dashboard`) , **Public** rakho (GitHub Pages free public repo pe
   sabse easy hai) , **Create repository**.
3. **Add file , Upload files** , is folder ki **saari files** (index.html, style.css,
   pipeline.js, app.js, visual-report-template.html, README, DEPLOY, LICENSE) drag
   karke daal do.
   > Files repo ke root pe honi chahiye (index.html seedha dikhe).
4. **Commit changes**.

## PART C, GitHub Pages ON karo
1. Repo mein **Settings** , left mein **Pages**.
2. **Source**: "Deploy from a branch". **Branch**: `main`, folder: `/ (root)`. **Save**.
3. 1 se 2 minute ruko. Upar ek link aayega: `https://<username>.github.io/<repo>/`
   , **yehi tumhara live dashboard hai**.

## PART D, Use karo
1. Wo link kholo.
2. Upar **Settings** kholo , apni **OpenRouter key** paste karo , **model** chuno ,
   **Save settings**. Koi model pehle se chuna hua nahi aata, aap jo chunoge wahi
   aage se aapka default ban jayega. (Balance ke liye Claude Sonnet 5, sabse best
   ke liye Claude Opus 5, saste ke liye Gemini 3.5 Flash ya GPT-5.6 Luna.)
3. Business daalo (jaise `seohub.ae`), English/Hinglish chuno, byline (optional).
   Agar business ke baare mein kuch pehle se pata hai (location, kitne customers,
   real competitor, wagairah), toh "Extra info" box mein likh do, isse research
   zyada accurate hoti hai, khaaskar kam-known business ke liye.
4. **Run deep research** dabao. Tab **khula rakhna**. 15 se 30 min mein visual report
   usi page pe aa jaayega, saath mein download buttons (HTML, PDF, Word, diagrams).

## Local pe chalana ho (optional)
Sidha index.html double-click mat karna (template fetch block ho jaata hai). Chhota
local server chalao:
```
cd business-model-builder-openrouter
python3 -m http.server 8000
```
Phir kholo http://localhost:8000

## Tips
- Key sirf tumhare browser mein save hoti hai, GitHub pe kabhi nahi jaati , safe.
- Free models rate-limited hote hain aur final design step mein kamzor , acche result
  ke liye paid model (Claude/GPT) behtar.
- Run beech mein fail ho jaaye ya tab band ho jaaye toh ghabrana mat: jo steps ho chuke
  hain wo save rehte hain. Wahi business dobara run karo, app wahin se aage chalu kar
  dega, dobara paise nahi lagenge. Naye sire se shuru karna ho toh Run button ke upar
  wale banner mein "Discard saved progress" daba do.
- Koi error aaye (jaise 401 = key galat, 402 = credit chahiye, 429 = limit, 404 = model
  id galat) toh mujhe message bata dena, turant theek kar denge.
