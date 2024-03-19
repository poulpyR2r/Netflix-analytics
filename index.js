require("dotenv").config();
const puppeteer = require("puppeteer");

let browser;
let page;

async function initialize() {
  browser = await puppeteer.launch({ headless: false });
  page = await browser.newPage();
}

async function closeBrowser() {
  await browser.close();
}

async function connectionNetflix() {
  if (!browser || !page) {
    throw new Error("Browser or page not initialized");
  }

  // Aller à la page de connexion de Netflix
  await page.goto("https://www.netflix.com/fr/login");
  await page.screenshot({ path: "PageLogingBefore.png" });
  await page.type("#id_userLoginId", process.env.NETFLIX_EMAIL, { delay: 100 });
  await page.type("#id_password", process.env.NETFLIX_PASSWORD, { delay: 100 });
  const navigationPromise = page.waitForNavigation(); // Préparez-vous à attendre la navigation
  await page.click(".btn.login-button.btn-submit.btn-small");
  await navigationPromise; // Attendre que la navigation soit terminée
  await page.waitForSelector(".profile-icon"); // Attendre un élément spécifique sur la page d'accueil
  await page.screenshot({ path: "PageLogingAfter.png" });
}

async function selectProfile(profileName) {
  const profileLink = await page.$$eval(
    ".profile-link",
    (links, name) => {
      for (const link of links) {
        const nameElement = link.querySelector(".profile-name");
        if (nameElement && nameElement.textContent.trim() === name) {
          return link.href;
        }
      }
      return null;
    },
    profileName
  );
  if (!profileLink) {
    throw new Error(`Profile with name ${profileName} not found.`);
  }
  await page.goto(profileLink);
  await page.screenshot({ path: "after_selection.png" });
}

async function extractFullHistory() {
  try {
    await page.goto("https://www.netflix.com/viewingactivity");

    let previousRowCount = 0;
    let currentRowCount = await page.$$eval(
      ".retableRow",
      (rows) => rows.length
    );

    // Affiche le nombre initial d'éléments
    console.log(`Initial count: ${currentRowCount}`);

    // Le sélecteur du bouton "Voir plus"
    const loadMoreButtonSelector = "button.btn.btn-blue.btn-small";

    while (true) {
      if (await page.$(loadMoreButtonSelector)) {
        await page.click(loadMoreButtonSelector); // Clique sur le bouton
        await page.waitForTimeout(2000); // Attend 5 secondes pour voir si les nouvelles données sont chargées

        previousRowCount = currentRowCount;
        currentRowCount = await page.$$eval(
          ".retableRow",
          (rows) => rows.length
        );

        // Affiche le nombre d'éléments après chaque clic
        console.log(
          `Previous count: ${previousRowCount}, Current count: ${currentRowCount}`
        );

        // Si le nombre de lignes ne change pas après le clic, sortez de la boucle
        if (previousRowCount === currentRowCount) {
          break;
        }
      } else {
        break; // Si le bouton n'est pas trouvé, sortez de la boucle
      }
    }

    // Une fois que tout l'historique est chargé, extrayez les données
    const history = await page.$$eval(".retableRow", (rows) =>
      rows.map((row) => {
        const date = row.querySelector(".date").textContent.trim();
        const titleLink = row.querySelector(".title > a");
        const title = titleLink.textContent.trim();
        const url = titleLink.getAttribute("href");
        const reportLink = row
          .querySelector(".reportLink")
          .getAttribute("href");
        return { date, title, url, reportLink };
      })
    );

    console.log(history);
  } catch (error) {
    console.error("Une erreur s'est produite:", error.message);
  }
}

extractFullHistory().catch((error) => {
  console.error("Une erreur s'est produite:", error.message);
});

async function getMyList() {
  await page.goto("https://www.netflix.com/browse/m/my-list");

  //get name list  films/series
  const ariaLabel = await page.$$eval(".galleryLockups a", (anchors) =>
    anchors.map((a) => a.getAttribute("aria-label"))
  );
  //get link list films/series
  const links = await page.$$eval(".galleryLockups a", (anchors) =>
    anchors.map((a) => a.href)
  );
  //get images list films/series
  const images = await page.$$eval(".galleryLockups img", (imgs) =>
    imgs.map((img) => img.src)
  );
}

async function lastHistory() {
  const history = await page.$$eval(".retableRow", (rows) =>
    rows.map((row) => {
      const date = row.querySelector(".date").textContent.trim();
      const titleLink = row.querySelector(".title > a");
      const title = titleLink.textContent.trim();
      const url = titleLink.getAttribute("href");
      const reportLink = row.querySelector(".reportLink").getAttribute("href");
      return { date, title, url, reportLink };
    })
  );
  console.log(history);
}

(async () => {
  try {
    console.log("Initialisation...");
    await initialize();
    console.log("Connexion à Netflix...");
    await connectionNetflix();
    console.log("Connexion réussie.");
    await selectProfile(process.env.NETFLIX_NAME);
    console.log("Profil sélectionné.");
    await getMyList();
    console.log("Liste affiché.");
    await lastHistory();
    console.log("Dernier historique affiché.");
    // await extractFullHistory();
    // console.log("Historique affiché.");
    await closeBrowser();
  } catch (error) {
    console.error("Une erreur s'est produite :", error);
    if (browser) {
      await closeBrowser();
    }
  }
})();
