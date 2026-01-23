// wdoms_scraper.js
// Scrapes World Directory of Medical Schools search results (Operational: Yes) into JSON.
// Use responsibly and in compliance with the site's terms and robots rules.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const START_URL = 'https://search.wdoms.org/?_gl=1*awjkkx*_ga*MTUwMjM0MjI3LjE3NjkxNTE5MDQ.*_ga_R5BJZG5EYE*czE3NjkxNTE5MDMkbzEkZzAkdDE3NjkxNTE5MDgkajU1JGwwJGgw';

async function scrape() {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  console.log('Navigating to search page...');
  await page.goto(START_URL, { waitUntil: 'networkidle2' });

  // Wait for the operational select to appear
  // Based on the snapshot, the operational field is a combobox
  await new Promise(resolve => setTimeout(resolve, 2000)); // Give page time to fully load

  console.log('Setting Operational to "Yes"...');
  
  // Find and select the operational dropdown
  // The combobox has options "Ye" (Yes) and "No"
  const operationalSelected = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      const options = Array.from(select.options);
      const yesOption = options.find(opt => {
        const text = opt.textContent.trim().toLowerCase();
        return text === 'yes' || text === 'ye' || text.includes('yes');
      });
      
      if (yesOption) {
        select.value = yesOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }
    return false;
  });

  if (operationalSelected) {
    console.log('✅ Selected Operational: Yes');
  } else {
    throw new Error('Could not find Operational dropdown with Yes option');
  }
  
  await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for form to update

  // Submit the search
  console.log('Submitting search...');
  
  // Wait for search button to be available
  await page.waitForSelector('button', { timeout: 10000 });
  
  // Get all buttons and find the search button
  const buttons = await page.$$('button');
  let searchButton = null;
  
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent.trim().toLowerCase(), button);
    if (text.includes('search') && !text.includes('clear')) {
      searchButton = button;
      break;
    }
  }
  
  if (!searchButton) {
    // Try input buttons
    const inputButtons = await page.$$('input[type="submit"], input[type="button"]');
    for (const btn of inputButtons) {
      const value = await page.evaluate(el => (el.value || '').toLowerCase(), btn);
      if (value.includes('search')) {
        searchButton = btn;
        break;
      }
    }
  }
  
  if (!searchButton) {
    // Debug: log all buttons
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      return buttons.map(btn => ({
        tag: btn.tagName,
        text: btn.textContent.trim(),
        value: btn.value || '',
        type: btn.type || ''
      }));
    });
    console.log('Available buttons:', JSON.stringify(allButtons, null, 2));
    throw new Error('Could not find Search button');
  }
  
  // Click the search button
  await searchButton.click();

  // Wait for navigation to results page
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Search submitted, waiting for results...');
  } catch (e) {
    // Sometimes the page doesn't trigger navigation event, wait a bit
    console.log('Waiting for results page to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Wait for results to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if we're on results page or still on search page
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // Extract all schools from all pages
  console.log('Extracting results...');
  const allSchools = [];

  // Helper function to extract rows from current page
  async function extractCurrentPageRows() {
    const rows = await page.evaluate(() => {
      const results = [];
      
      // Try to find table rows - most common structure
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const tbody = table.querySelector('tbody');
        if (!tbody) continue;
        
        const tableRows = tbody.querySelectorAll('tr');
        if (tableRows.length === 0) continue;
        
        const headerRow = table.querySelector('thead tr');
        const headers = headerRow ? 
          Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim()) :
          [];

        tableRows.forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          
          if (cells.length === 0) return;

          const school = {};
          
          // Map cells to headers if available
          if (headers.length > 0 && headers.length === cells.length) {
            headers.forEach((header, i) => {
              if (i < cells.length) {
                const key = header
                  .toLowerCase()
                  .replace(/\s+/g, '_')
                  .replace(/[^a-z0-9_]/g, '')
                  || `col_${i}`;
                school[key] = cells[i] || null;
              }
            });
          } else {
            // If no headers or mismatch, use generic column names
            cells.forEach((cell, i) => {
              school[`col_${i}`] = cell;
            });
          }

          // Try to find detail link
          const link = tr.querySelector('a[href]');
          if (link) {
            const href = link.href;
            if (href && !href.includes('javascript:')) {
              school.detail_url = href;
            }
            const linkText = link.textContent.trim();
            if (linkText) {
              school.school_name = linkText;
            }
          }

          // If no school name found, try first cell
          if (!school.school_name && cells.length > 0) {
            school.school_name = cells[0];
          }

          results.push(school);
        });
      }

      // If no table found, try to find list items or divs with school info
      if (results.length === 0) {
        const listItems = document.querySelectorAll('li, div[class*="school"], div[class*="result"], div[class*="item"]');
        listItems.forEach((item) => {
          const text = item.textContent.trim();
          if (text.length > 10) { // Basic filter for meaningful content
            const link = item.querySelector('a[href]');
            const schoolData = {
              school_name: text.split('\n')[0], // First line as name
              raw_text: text
            };
            if (link && link.href && !link.href.includes('javascript:')) {
              schoolData.detail_url = link.href;
            }
            results.push(schoolData);
          }
        });
      }

      return results;
    });

    return rows;
  }

  // Extract all pages
  let pageNum = 1;
  let previousUrl = page.url();
  let consecutiveEmptyPages = 0;
  const maxEmptyPages = 3;

  while (true) {
    console.log(`\n📄 Extracting page ${pageNum}...`);
    console.log(`   Current URL: ${page.url()}`);
    
    const pageRows = await extractCurrentPageRows();
    console.log(`   ✅ Found ${pageRows.length} schools on page ${pageNum}`);
    
    if (pageRows.length === 0) {
      consecutiveEmptyPages++;
      console.log(`   ⚠️  Empty page (${consecutiveEmptyPages}/${maxEmptyPages})`);
      if (consecutiveEmptyPages >= maxEmptyPages) {
        console.log('   🛑 No more results found. Stopping.');
        break;
      }
    } else {
      consecutiveEmptyPages = 0;
      allSchools.push(...pageRows);
      console.log(`   📊 Total schools collected so far: ${allSchools.length}`);
    }

    // Save progress every 10 pages
    if (pageNum % 10 === 0) {
      const tempPath = path.join(process.cwd(), 'wdoms_medical_schools_operational_yes_partial.json');
      fs.writeFileSync(tempPath, JSON.stringify(allSchools, null, 2));
      console.log(`   💾 Checkpoint saved: ${tempPath}`);
    }

    // Try multiple strategies to find and click next page
    let nextClicked = false;
    const currentUrlBeforeClick = page.url();

    // Strategy 1: Look for "Next" button/link by text
    const nextButton = await page.evaluate(() => {
      const allElements = document.querySelectorAll('a, button, [role="button"]');
      for (const el of allElements) {
        const text = el.textContent.trim().toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        
        if ((text === 'next' || text.includes('next') || ariaLabel.includes('next')) &&
            !text.includes('previous') && !text.includes('prev')) {
          const disabled = el.getAttribute('aria-disabled') === 'true' ||
                         el.classList.contains('disabled') ||
                         el.hasAttribute('disabled') ||
                         el.classList.contains('inactive');
          if (!disabled) {
            return {
              found: true,
              tag: el.tagName,
              text: text,
              selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + 
                       (el.className ? '.' + el.className.split(' ')[0] : '')
            };
          }
        }
      }
      return { found: false };
    });

    if (nextButton.found) {
      console.log(`   🔍 Found Next button: ${nextButton.text}`);
      try {
        // Try clicking by text content
        await page.evaluate(() => {
          const allElements = document.querySelectorAll('a, button, [role="button"]');
          for (const el of allElements) {
            const text = el.textContent.trim().toLowerCase();
            if ((text === 'next' || text.includes('next')) && !text.includes('previous')) {
              const disabled = el.getAttribute('aria-disabled') === 'true' ||
                             el.classList.contains('disabled') ||
                             el.hasAttribute('disabled');
              if (!disabled) {
                el.click();
                return true;
              }
            }
          }
          return false;
        });

        nextClicked = true;
      } catch (e) {
        console.log(`   ⚠️  Error clicking Next button: ${e.message}`);
      }
    }

    // Strategy 2: Look for numbered pagination (e.g., page 2, 3, etc.)
    if (!nextClicked) {
      const nextPageNum = pageNum + 1;
      const pageLink = await page.evaluate((targetPage) => {
        const allElements = document.querySelectorAll('a, button, [role="button"]');
        for (const el of allElements) {
          const text = el.textContent.trim();
          // Look for exact page number or ">" symbol
          if (text === String(targetPage) || text === '>' || text === '»') {
            const disabled = el.getAttribute('aria-disabled') === 'true' ||
                           el.classList.contains('disabled') ||
                           el.hasAttribute('disabled');
            if (!disabled) {
              return true;
            }
          }
        }
        return false;
      }, nextPageNum);

      if (pageLink) {
        console.log(`   🔍 Found page ${nextPageNum} link`);
        try {
          await page.evaluate((targetPage) => {
            const allElements = document.querySelectorAll('a, button, [role="button"]');
            for (const el of allElements) {
              const text = el.textContent.trim();
              if (text === String(targetPage) || text === '>' || text === '»') {
                const disabled = el.getAttribute('aria-disabled') === 'true' ||
                               el.classList.contains('disabled') ||
                               el.hasAttribute('disabled');
                if (!disabled) {
                  el.click();
                  return true;
                }
              }
            }
            return false;
          }, nextPageNum);
          nextClicked = true;
        } catch (e) {
          console.log(`   ⚠️  Error clicking page ${nextPageNum}: ${e.message}`);
        }
      }
    }

    // Strategy 3: Look for pagination with aria-label or data attributes
    if (!nextClicked) {
      const paginationInfo = await page.evaluate(() => {
        // Look for pagination info (e.g., "Page 1 of 100")
        const paginationText = Array.from(document.querySelectorAll('*')).find(el => {
          const text = el.textContent.trim().toLowerCase();
          return text.includes('page') && (text.includes('of') || text.includes('/'));
        });
        
        // Look for pagination controls
        const paginationControls = document.querySelector('[role="navigation"], .pagination, [class*="pagination"], [class*="pager"]');
        
        return {
          hasPaginationText: !!paginationText,
          hasPaginationControls: !!paginationControls
        };
      });

      if (paginationInfo.hasPaginationControls || paginationInfo.hasPaginationText) {
        console.log('   🔍 Found pagination controls, trying to navigate...');
        // Try to find and click the next page element
        try {
          const clicked = await page.evaluate(() => {
            const nav = document.querySelector('[role="navigation"], .pagination, [class*="pagination"]');
            if (nav) {
              const links = nav.querySelectorAll('a, button');
              for (const link of links) {
                const text = link.textContent.trim().toLowerCase();
                if (text === 'next' || text === '>' || text === '»' || 
                    (text.match(/^\d+$/) && parseInt(text) > 1)) {
                  const disabled = link.getAttribute('aria-disabled') === 'true' ||
                                 link.classList.contains('disabled') ||
                                 link.hasAttribute('disabled');
                  if (!disabled) {
                    link.click();
                    return true;
                  }
                }
              }
            }
            return false;
          });
          if (clicked) nextClicked = true;
        } catch (e) {
          console.log(`   ⚠️  Error with pagination controls: ${e.message}`);
        }
      }
    }

    if (!nextClicked) {
      console.log('   🛑 Could not find next page button/link. Finished extracting.');
      break;
    }

    // Wait for navigation
    console.log('   ⏳ Waiting for next page to load...');
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
    } catch (e) {
      // Navigation might not trigger, wait a bit anyway
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Check if URL changed (indicates navigation happened)
    const currentUrlAfterClick = page.url();
    if (currentUrlAfterClick === currentUrlBeforeClick && pageNum > 1) {
      console.log('   ⚠️  URL did not change, might be on last page');
      // Try one more time with a longer wait
      await new Promise(resolve => setTimeout(resolve, 3000));
      const pageRowsAfterWait = await extractCurrentPageRows();
      if (pageRowsAfterWait.length === 0) {
        console.log('   🛑 Confirmed no more results. Stopping.');
        break;
      }
    }

    pageNum++;
    previousUrl = currentUrlAfterClick;

    // Safety limit
    if (pageNum > 10000) {
      console.log('   🛑 Reached safety limit of 10000 pages. Stopping.');
      break;
    }
  }

  // Save results
  const outPath = path.join(process.cwd(), 'wdoms_medical_schools_operational_yes.json');
  fs.writeFileSync(outPath, JSON.stringify(allSchools, null, 2));
  console.log(`\n✅ Done! Extracted ${allSchools.length} medical schools`);
  console.log(`📁 Saved to: ${outPath}`);

  await browser.close();
}

scrape().catch((err) => {
  console.error('❌ Scrape failed:', err);
  process.exit(1);
});
