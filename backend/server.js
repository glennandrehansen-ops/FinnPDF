const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
    res.status(200).send('Serveren er våken');
});

app.get('/api/scrape', async (req, res) => {
    let { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Manglende URL eller Finn-kode' });
    }

    if (/^\d{8,10}$/.test(url)) {
        url = `https://www.finn.no/bap/forsale/ad.html?finnkode=${url}`;
    } else if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const adData = await page.evaluate(() => {
            const getText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.innerText.trim() : 'Ikke funnet';
            };

            const getImage = () => {
                const imgEl = document.querySelector('img[src*="finncdn.no/dynamic"]');
                return imgEl ? imgEl.src : '';
            };

            const title = getText('h1') || getText('[data-testid="ad-heading"]');
            const description = getText('.import-decoration') || getText('[data-testid="ad-description"]');
            const seller = getText('[data-testid="profile-name"]') || getText('.profile-name') || 'Ukjent selger';
            
            let published = 'Ukjent';
            let modified = 'Ukjent';
            
            const trElements = document.querySelectorAll('tr, .key-value-list__item');
            trElements.forEach(tr => {
                const text = tr.innerText.toLowerCase();
                if (text.includes('publisert') || text.includes('lagt inn')) {
                    published = tr.innerText.split('\n')[1] || tr.innerText.replace(/publisert|lagt inn/i, '').trim();
                }
                if (text.includes('sist endret') || text.includes('oppdatert')) {
                    modified = tr.innerText.split('\n')[1] || tr.innerText.replace(/sist endret|oppdatert/i, '').trim();
                }
            });

            return {
                title,
                image: getImage(),
                description,
                seller,
                published,
                modified,
                url: document.location.href
            };
        });

        await browser.close();
        res.json(adData);

    } catch (error) {
        console.error('Feil under skraping:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: 'Kunne ikke hente data fra Finn.no. Annonsen kan være slettet, eller blokkering oppsto.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Scraper-backend kjører på port ${PORT}`);
});
