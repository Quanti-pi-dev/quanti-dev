const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('server/seed.json', 'utf8'));

let kinematicsLevels = null;

data.exams.forEach(exam => {
  if (exam.title === "JEE Main") {
    exam.subjects.forEach(sub => {
      if (sub.name === "Physics") {
        sub.topics.forEach(top => {
          if (top.slug === "kinematics") {
            kinematicsLevels = top.levels;
          }
        });
      }
    });
  }
});

if (kinematicsLevels) {
  const outputDir = path.join(__dirname, 'bulk_imports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [levelName, cards] of Object.entries(kinematicsLevels)) {
    // Add "imageUrl": null to each card to strictly match bulk-insert-example.json if we want, but it's optional
    const formattedCards = cards.map(card => {
        return {
           ...card,
           imageUrl: card.imageUrl || null
        };
    });

    const outputData = { cards: formattedCards };
    const filePath = path.join(outputDir, `${levelName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2));
    console.log(`Created ${filePath} with ${cards.length} cards.`);
  }
} else {
  console.log("Could not find Physics > Kinematics levels.");
}
