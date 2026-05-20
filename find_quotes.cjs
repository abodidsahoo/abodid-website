const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/Users/abodid/Documents/GitHub/personal-site/src/data/uk2026.json', 'utf8'));

const quotes = [
  "When you want something, all the universe conspires in helping you to achieve it.",
  "A few days later, I saw INR 1,00,000 credited to my bank account. Yes, One Lac. Again I went, “Omg! Is this even real?” I was honestly not expecting this large an amount from an individual.",
  "I had never thought I would dive into the fashion space this way ever!!",
  "I literally wore the outfits by Kunsquad repeatedly in London as if they were my comfort food.",
  "The love I get there in London sometimes makes me feel two ways about the idea of a home. Is home a place? Or is it the people who make you feel at home?",
  "She casually announced that the best outfit award goes to this duo!",
  "I was so happy to see Yashaswinee confidently explaining the research to so many people.",
  "The work revolved around the aftereffects of rejection and how it triggers other past unresolved grief.",
  "It takes a whole lot of guts as a middle-class Indian man and a courageous decolonial mindset to stand on stage in front of a set of international speakers and handle those sessions in a white man’s land.",
  "A bunch of 30-odd people, including Brits, French, Italians, Poles, Americans, Bengalis, Assamese, Punjabis, Marathis, and, of course, Odias. Not just diversity-wise, profession-wise, it was a bunch of engineers, researchers, analysts, designers, artists and entrepreneurs. Sometimes I wonder what I have earned in my life. This, this, this.",
  "Technology does not save the world without systematic change",
  "AI literally has zero use case, in my honest opinion",
  "I learnt to read Braille for the first time during one of the activities. It was on my wishlist for a long time!!",
  "For a moment, I realised I was amongst a group of some really talented folks.",
  "Eleanor told me it’s a beautiful, intricate painting, and it would be nice to have it in the Digital Humanities department’s new building. I couldn’t process the fact that it would go into the walls of the University of Cambridge.",
  "That day with Nidhi, Sharath, and Yashaswinee by my side, I could see love and hope in those bowls of ramen."
];

let globalIndex = 0;
let results = [];

data.chapters.forEach(chapter => {
  chapter.paragraphs.forEach(paragraph => {
    globalIndex++;
    quotes.forEach((q, i) => {
      if (paragraph.replace(/[“”]/g, '"').includes(q.replace(/[“”]/g, '"'))) {
        results.push({
          afterParagraph: globalIndex,
          text: q
        });
      } else if (paragraph.includes(q.substring(0, 20))) { // fallback
         results.push({
          afterParagraph: globalIndex,
          text: q
        });
      }
    });
  });
});

console.log(JSON.stringify(results, null, 2));
