const fs = require('fs');
const file = '/Users/abodid/Documents/GitHub/personal-site/src/data/uk2026.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const newQuotes = [
  {
    "afterParagraph": 16,
    "text": "“When you want something, all the universe conspires in helping you to achieve it.”"
  },
  {
    "afterParagraph": 21,
    "text": "A few days later, I saw INR 1,00,000 credited to my bank account. Yes, One Lac. Again I went, “Omg! Is this even real?” I was honestly not expecting this large an amount from an individual."
  },
  {
    "afterParagraph": 32,
    "text": "I had never thought I would dive into the fashion space this way ever!!"
  },
  {
    "afterParagraph": 37,
    "text": "I literally wore the outfits by Kunsquad repeatedly in London as if they were my comfort food."
  },
  {
    "afterParagraph": 45,
    "text": "The love I get there in London sometimes makes me feel two ways about the idea of a home. Is home a place? Or is it the people who make you feel at home?"
  },
  {
    "afterParagraph": 51,
    "text": "She casually announced that the best outfit award goes to this duo!"
  },
  {
    "afterParagraph": 54,
    "text": "I was so happy to see Yashaswinee confidently explaining the research to so many people."
  },
  {
    "afterParagraph": 64,
    "text": "The work revolved around the aftereffects of rejection and how it triggers other past unresolved grief."
  },
  {
    "afterParagraph": 71,
    "text": "It takes a whole lot of guts as a middle-class Indian man and a courageous decolonial mindset to stand on stage in front of a set of international speakers and handle those sessions in a white man’s land."
  },
  {
    "afterParagraph": 83,
    "text": "A bunch of 30-odd people, including Brits, French, Italians, Poles, Americans, Bengalis, Assamese, Punjabis, Marathis, and, of course, Odias. Not just diversity-wise, profession-wise, it was a bunch of engineers, researchers, analysts, designers, artists and entrepreneurs. Sometimes I wonder what I have earned in my life. This, this, this."
  },
  {
    "afterParagraph": 118,
    "text": "“Technology does not save the world without systematic change.”"
  },
  {
    "afterParagraph": 120,
    "text": "“AI literally has zero use case, in my honest opinion,” Eleanor told us in the middle of the session while we were discussing the vibe-lifestyle we live with AI. That was perhaps one of the most powerful, impactful, and weirdly unsettling statements I had heard in the entire week in Cambridge."
  },
  {
    "afterParagraph": 152,
    "text": "I learnt to read Braille for the first time during one of the activities. It was on my wishlist for a long time!!"
  },
  {
    "afterParagraph": 158,
    "text": "For a moment, I realised I was amongst a group of some really talented folks."
  },
  {
    "afterParagraph": 169,
    "text": "Eleanor told me it’s a beautiful, intricate painting, and it would be nice to have it in the Digital Humanities department’s new building. I couldn’t process the fact that it would go into the walls of the University of Cambridge."
  },
  {
    "afterParagraph": 178,
    "text": "That day with Nidhi, Sharath, and Yashaswinee by my side, I could see love and hope in those bowls of ramen."
  }
];

data.pullQuotes = newQuotes;
fs.writeFileSync(file, JSON.stringify(data, null, 2));
