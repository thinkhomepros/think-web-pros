/* Think Web Pros Studio: help articles for the Help panel and tour (js/help.js).
   Text inside <span data-only="pc|tab|ph|touch"> only shows on that kind of device. */
window.TWP_HELP = (function () {
  'use strict';

  var cats = [
    ['start', 'Getting started'],
    ['words', 'Words, photos and buttons'],
    ['brand', 'Logo and business info'],
    ['style', 'Style, colors and fonts'],
    ['sections', 'Sections'],
    ['pages', 'Pages, menu and header'],
    ['save', 'Preview, undo and saving'],
    ['launch', 'Plans and launching'],
    ['devices', 'Phone and tablet tips'],
    ['trouble', 'Fixes and questions']
  ];

  var D = {
    design: '<span data-only="pc">Click <b>Design</b> in the top right corner</span><span data-only="tab">Tap <b>Design</b> in the top right corner</span><span data-only="ph">Tap the <b>palette button</b> in the top right corner</span>',
    sections: '<span data-only="pc">Click <b>Sections</b> in the top left</span><span data-only="tab">Tap <b>Sections</b> in the top left</span><span data-only="ph">Open the <b>⋯</b> menu and tap <b>Sections</b></span>',
    more: '<span data-only="pc">the top bar</span><span data-only="touch">the <b>⋯</b> menu</span>',
    click: '<span data-only="pc">Click</span><span data-only="touch">Tap</span>',
    next: '<span data-only="pc">Click <b>Next: plans</b> in the top right</span><span data-only="tab">Tap <b>Next: plans</b> in the top bar</span><span data-only="ph">Tap the <b>pink arrow</b> in the top bar</span>'
  };

  var articles = [
    /* getting started */
    { id: 'first-steps', cat: 'start', title: 'Start designing your website',
      keys: 'begin start new first time how to use studio builder overview',
      body: '<p>Open the studio and pick the kind of business you run. You will see a few layouts made for that kind of business. Each one comes with pages, a menu and words already written, so you start with a real site instead of a blank page.</p><ol><li>Pick your business type.</li><li>Pick a layout and choose <b>Use this layout</b>.</li><li>' + D.click + ' any words to change them and any photo to upload your own.</li><li>Add your logo and business info under <b>Design › Business</b>.</li><li>When you love it, go to plans and launch.</li></ol>' },
    { id: 'tour-replay', cat: 'start', title: 'See the tutorial again',
      keys: 'tutorial tour walkthrough replay intro guide show again popup welcome',
      body: '<p>Open <b>Help</b> and choose <b>Take the tour</b>. <span data-only="tab">On a tablet, Help is in the main menu (the logo button in the top left) and the <b>⋯</b> menu.</span><span data-only="ph">On a phone, Help is in the <b>☰</b> main menu and the <b>⋯</b> menu.</span> The tour adjusts itself to your computer, tablet or phone.</p>' },
    { id: 'tour-off', cat: 'start', title: 'Stop the tutorial from popping up',
      keys: 'dont show again turn off disable tutorial popup tour skip annoying hide welcome',
      body: '<p>Tick <b>Don\'t show this again</b> at the bottom of the tutorial, or finish it once, and it will not open by itself again on this device. If you only choose <b>Skip</b>, it may come back on your next visit. You can always reopen it from <b>Help</b>.</p><p class="muted">The choice is saved in this browser. Clearing your browser data or using a private window will bring the tutorial back once.</p>' },
    { id: 'business-type', cat: 'start', title: 'Change your business type or layout',
      keys: 'industry business type category layout template switch change type restaurant salon bakery',
      body: '<p>' + D.design + ', open <b>Business</b> and change <b>Type of business</b>. Choose <b>See layouts made for your business</b> to pick a different layout, or <b>Write my page</b> to fill your page with words written for that type of business.</p><p>On the first screen, <b>Change type</b> next to the layouts takes you back to the full list of 16 business types.</p>' },
    { id: 'quick-start', cat: 'start', title: 'Quick start form and starting over',
      keys: 'quick start form questions start over blank page reset new design fresh',
      body: '<p>The <b>Quick start form</b> asks a few questions and builds a page for you. Find it in ' + D.more + ' under <b>Design</b>, or in the <b>Designs</b> menu.</p><p><b>Start over</b>, in the same place, removes every section from the current design. You can undo right after. To keep your current design and begin a new one, use <b>New design</b> instead.</p>' },

    /* words, photos, buttons */
    { id: 'edit-text', cat: 'words', title: 'Change the words on your page',
      keys: 'edit text words type headline title paragraph change wording copy write',
      body: '<p>' + D.click + ' any words on the page and type over them. Press Enter for a new line where the text allows it. Your changes show up right away.</p><p>Each section also has a <b>Words</b> card under <b>Edit</b>, with a box for every headline, line and button label, which can be easier on a small screen.</p>' },
    { id: 'click-to-edit', cat: 'words', title: 'Click anything on your page to change it',
      keys: 'click tap edit change anything everything select footer menu link background hours address package question where how to edit',
      body: '<p>Everything you see in the preview opens its own controls when you ' + D.click.toLowerCase() + ' it, and the page stays in view while you edit.</p><ul><li><b>Words</b> change right where they are. A <b>quick edit bar</b> appears above them for color, size, font, bold, italic and alignment.</li><li><b>Photos</b> open your files so you can pick a new one.</li><li><b>Buttons</b> open a box for their words and where they go.</li><li><b>Logo or header</b> open the logo and menu settings.</li><li><b>Menu links</b> go to that page and open <b>Pages &amp; menu</b>, where you can rename, reorder or hide pages.</li><li><b>A package, question, dish, listing or social link</b> opens its section with that item\'s settings showing.</li><li><b>The space inside a card</b> (a service, package, review, question or dish, not its words) opens a quick edit bar for just that card.</li><li><b>Address, phone or hours</b> jump to the box where you change them.</li><li><b>Footer</b> opens your business name, address and phone.</li><li><b>Empty space in a section</b> selects the whole section and opens a quick edit bar for its fill, texture, photo and text color.</li><li><b>Page background</b>: ' + D.click.toLowerCase() + ' the strip under your footer, or the gray space around the preview, for a quick edit bar.</li></ul><p data-only="ph">On a phone, tap a section and then <b>Edit</b>. Its settings open on the item you tapped.</p>' },
    { id: 'text-color', cat: 'words', title: 'Change the color of some text',
      keys: 'text color font colour recolor words highlight',
      body: '<p>' + D.click + ' the words, then choose <b>Color</b> (the A with a colored line) in the small bar that appears above them. The color picker shows your logo colors, your site colors and colors you used recently. Light and dark versions each remember their own text colors.</p>' },
    { id: 'photos', cat: 'words', title: 'Add or replace a photo or video',
      keys: 'photo picture image video upload replace change gallery dish photo',
      body: '<p>' + D.click + ' <b>+ Photo or video</b> on any picture spot and choose a file from your device. <span data-only="pc">You can also drag a file straight onto the spot.</span> Videos play muted on a loop.</p><p>To remove or swap a photo later, select the section, choose <b>Edit</b> and open its <b>Photo</b> card.</p>' },
    { id: 'slideshow', cat: 'words', title: 'Photo slideshows (image rotator)',
      keys: 'slideshow rotator carousel slider slides gallery captions seconds dots indicator',
      body: '<p>Add the <b>Image rotator</b> section from ' + (D.sections.replace(/<\/?b>/g, '')) + '. Then select it and choose <b>Edit</b> to add or remove slides, set how many seconds each slide shows, write a caption on each photo and pick an indicator style: dots, pills, progress bars, thumbnails, a counter or none.</p>' },
    { id: 'buttons', cat: 'words', title: 'Change where a button goes',
      keys: 'button link url call text email map phone page section cta contact us',
      body: '<p>Every button has a small pink link badge. ' + D.click + ' it to change the button\'s label and where it goes: a page on your site, a section, a phone call, a text message, an email, a map, or any web address.</p><p>You can also select the section, choose <b>Edit</b> and open the <b>Buttons</b> card to change all of its buttons in one place.</p>' },
    { id: 'banner', cat: 'words', title: 'Add a banner message across the top',
      keys: 'banner announcement top bar ticker sale message notice promo',
      body: '<p>' + D.click + ' <b>+ Add a banner message across the top</b>, right above your header. Write your message, then choose a plain bar or a scrolling ticker, its colors and size, which pages show it, and whether visitors can close it. Choose <b>Remove banner</b> to take it off.</p>' },
    { id: 'food-menu', cat: 'words', title: 'Food menus, prices and categories',
      keys: 'menu food dishes prices restaurant cafe category add dish drinks',
      body: '<p>Add the <b>Food menu</b> section from ' + (D.sections.replace(/<\/?b>/g, '')) + '. ' + D.click + ' a dish name, description or price to type over it. Use <b>+ Add a dish</b> under a category and <b>+ Add a category</b> for a new group like Drinks or Desserts. Each dish can have its own photo.</p>' },

    /* logo and business info */
    { id: 'business-info', cat: 'brand', title: 'Add your business name, phone, email and address',
      keys: 'business info name phone email address about contact details hidden hide nap',
      body: '<p>' + D.design + ' and choose <b>Business</b>. Fill in each card: business name, type of business, phone, email, street address and a short line about your business. Your page updates as you type.</p><p>Rather not show your phone, email or address on the site? Switch it to <b>Hidden</b>. We still need it to set up your account, and it helps Google and AI assistants describe your business correctly.</p>' },
    { id: 'logo-upload', cat: 'brand', title: 'Upload your logo',
      keys: 'logo upload image brand png svg transparent replace',
      body: '<p>' + D.design + ', choose <b>Business</b> and go to the <b>Logo</b> card. <span data-only="pc">Drop a file on it or click <b>Upload</b>.</span><span data-only="touch">Tap <b>Upload</b> and pick the file.</span> Your logo appears across your site and owner dashboard. A logo with a transparent background looks best on both light and dark versions.</p>' },
    { id: 'logo-ai', cat: 'brand', title: 'Make a logo with the AI logo maker',
      keys: 'ai logo maker create generate design draw artificial intelligence no logo',
      body: '<p>No logo yet? On the <b>Logo</b> card choose <b>Create a logo in the logo maker</b> and describe what you want in your own words, such as "a friendly loaf of bread with a sun". Your first 3 AI requests are free. The AI logo package ($49 once) unlocks unlimited requests and changes. Prefer a person? A Think Web Pros designer can draw 3 concepts for you as an add-on.</p>' },
    { id: 'logo-colors', cat: 'brand', title: 'Use your logo colors on your site',
      keys: 'logo colors palette scheme match brand colours suggested',
      body: '<p>When you upload a logo, the studio picks out its colors and suggests 4 color schemes built from them. Open <b>Design › Style</b> and look under <b>Colors</b> to apply one. Every color picker in the studio also shows your logo colors first, so it is easy to stay on brand.</p>' },

    /* style */
    { id: 'site-style', cat: 'style', title: 'Change the whole look of your site',
      keys: 'style theme look design template classic magazine loud luxe playful glass portfolio retro',
      body: '<p>' + D.design + ' and choose <b>Style</b>. Under <b>Site style</b>, pick from 8 looks: Classic, Magazine, Loud, Luxe, Playful, Glass, Portfolio and Retro. Each one changes the layout, type and feel of your site, not just the colors. Your words and photos stay put.</p>' },
    { id: 'light-dark', cat: 'style', title: 'Light and dark versions',
      keys: 'dark mode light mode night theme switch flip',
      body: '<p>Every site has a light and a dark version, and each one keeps its own colors. <span data-only="pc">Click <b>Light</b> (or <b>Dark</b>) in the top bar to flip between them.</span><span data-only="tab">Tap the sun or moon button in the top bar to flip between them.</span><span data-only="ph">Open the <b>⋯</b> menu and tap <b>Show dark version</b>.</span> You can also switch under <b>Design › Style › Site style</b>.</p>' },
    { id: 'colors-fonts', cat: 'style', title: 'Change colors and fonts',
      keys: 'colors colours fonts typeface typography accent palette',
      body: '<p>Open <b>Design › Style</b> and swipe to <b>Colors and fonts</b>. Pick one of the suggested schemes, or set each color yourself. Under <b>Fonts</b>, choose a pairing for headlines and body text.</p>' },
    { id: 'shape', cat: 'style', title: 'Rounded or square corners',
      keys: 'shape corners rounded square buttons cards radius',
      body: '<p>Open <b>Design › Style</b> and find <b>Shape</b>. Choose how round the corners of buttons, cards and photos are, from square to fully rounded.</p>' },
    { id: 'backgrounds', cat: 'style', title: 'Backgrounds: color, gradient, texture or photo',
      keys: 'background texture gradient pattern photo backdrop page background section background opacity',
      body: '<p>For the whole page, ' + D.click.toLowerCase() + ' the <b>Page background</b> strip under your footer, or the gray space around the preview. A quick edit bar opens there, and its <b>More</b> button opens <b>Design › Style › Page background</b>. For one section, select it, choose <b>Edit</b> and open its <b>Background</b> card. For a single card inside a section, use <b>Card style</b>.</p><p>You can use a plain color, a gradient, one of 21 textures (with intensity and size controls), your own texture image, or a background photo with a color behind it, plus opacity and fade.</p>' },
    { id: 'quick-edit', cat: 'words', title: 'Quick edit: change a look without opening menus',
      keys: 'quick edit popup toolbar bar fast font size bigger smaller bold italic align center fill color texture photo text color shape border corners shadow more options',
      body: '<p>' + D.click + ' anything on your page and a small dark bar opens right next to it with the changes people make most. <b>More</b> on the bar opens every setting for that spot.</p><ul><li><b>Words</b>: color, smaller or bigger (<b>A−</b> and <b>A+</b>), font, <b>B</b> for bold, <i>I</i> for italic, and alignment (left, center or right). <b>Reset</b> puts that text back to the style.</li><li><b>A card</b> (' + D.click.toLowerCase() + ' the space inside it): fill color, texture, photo, text color and <b>Shape</b> for border, corners and shadow.</li><li><b>A section</b> (' + D.click.toLowerCase() + ' an empty spot in it): fill color, texture, photo and text color for the whole section.</li><li><b>The page background</b> (' + D.click.toLowerCase() + ' the gray space around the preview or the strip under your footer): fill color, texture, photo and text color.</li></ul><p data-only="ph">On a phone the bar sits at the bottom of the screen so it never covers what you tapped.</p><p>Every change can be undone with <b>Undo</b>, and it is saved with your design.</p>' },
    { id: 'card-style', cat: 'style', title: 'Style one card or panel on its own',
      keys: 'card panel box tile item package service review question dish listing member one card own color background text color font color border corners shadow texture different single separate each',
      body: '<p>Every card inside a section, such as a service, package, review, question, dish, listing or team member, can have its own look. ' + D.click + ' the space inside the card (not its words or photo) and a quick edit bar opens for it. Its <b>More</b> button opens <b>Card style</b> with that card picked. You can also open a section\'s <b>Edit</b> settings and go to <b>Card style</b>, or use the <b>sparkle button</b> on any item there.</p><ul><li><b>Pick a card</b> from the row of names. A dot marks the cards you have changed.</li><li><b>Text color</b> for all the words in that card. Words you colored one by one keep their own color.</li><li><b>Border</b>, <b>Corners</b> and <b>Shadow</b>.</li><li><b>Card background</b>: a color, gradient, one of 21 textures, your own texture image, or a photo.</li></ul><p><b>Use on every card</b> copies the look to the other cards in that section. <b>Reset to section style</b> puts one card back, and <b>Reset all cards</b> undoes them all. A card keeps its look when you move it up or down, and the same look shows in light and dark mode. If you give a card a dark or bright fill without picking a text color, the words switch to a readable color for you.</p>' },
    { id: 'saved-styles', cat: 'style', title: 'Save a look and come back to it',
      keys: 'saved styles save look favorite preset compare',
      body: '<p>Open <b>Design › Style › Saved styles</b> and choose <b>Save this style</b>. It keeps the look, layouts and both color versions so you can try something else and come back. To keep a whole separate site, use <b>Save as a copy</b> instead.</p>' },

    /* sections */
    { id: 'select-section', cat: 'sections', title: 'Select a whole section',
      keys: 'select section toolbar name tag pill click empty space',
      body: '<p>' + D.click + ' the dark name tag at the top left of a section, such as <b>Hero banner section</b>. <span data-only="pc">You can also click empty space inside the section.</span> A toolbar appears with the section\'s layout, <b>Edit</b>, move up, move down, hide and delete.</p>' },
    { id: 'add-section', cat: 'sections', title: 'Add a section',
      keys: 'add section new block contact map hours testimonials reviews services pricing team faq gallery',
      body: '<p>' + D.sections + '. Sections popular for your type of business are at the top, and every other section is below. <span data-only="pc">Drag one onto the page where you want it, or click <b>+</b> to add it.</span><span data-only="touch">Tap <b>+</b> to add one.</span></p><p>Your plan sets how many sections a site can have: up to 6 on Starter, 10 on Growth and 20 on Pro.</p>' },
    { id: 'move-section', cat: 'sections', title: 'Move a section up or down',
      keys: 'move reorder drag order arrange up down section position',
      body: '<p>Select the section and use the up and down arrows in its toolbar. You can also drag it by the dotted grip, on the page or in the <b>Your page</b> list in the Sections panel. <span data-only="pc">With the grip focused, the arrow keys move it too.</span></p>' },
    { id: 'section-layout', cat: 'sections', title: 'Change how a section is laid out',
      keys: 'section layout split centered overlay variant arrangement design of section',
      body: '<p>Select the section and use the layout button in its toolbar (it shows the current layout, like <b>Split</b>) to cycle through options. Or choose <b>Edit</b> and open the <b>Layout</b> card to see them all, such as Split, Centered, Photo overlay and Big headline.</p>' },
    { id: 'hide-delete', cat: 'sections', title: 'Hide, duplicate or delete a section',
      keys: 'hide delete remove duplicate copy section trash eye',
      body: '<p>Select the section. In its toolbar, the eye button hides it (it stays in the studio, marked Hidden, but visitors will not see it) and the trash button deletes it. Under <b>Edit › Layout</b> you will also find <b>Duplicate</b>. Deleted something by mistake? Use <b>Undo</b>.</p>' },
    { id: 'social', cat: 'sections', title: 'Show your social media',
      keys: 'social media instagram facebook tiktok youtube links icons feed',
      body: '<p>Add the <b>Social media</b> section from ' + (D.sections.replace(/<\/?b>/g, '')) + '. Choose <b>Edit</b> to add each network and your name or link, then pick icons, cards or a feed, in each network\'s own colors or matched to your site.</p>' },

    /* pages, menu, header */
    { id: 'add-page', cat: 'pages', title: 'Add, rename or reorder pages',
      keys: 'page add new page rename reorder delete pages about contact multiple pages',
      body: '<p>Open the page picker in the top bar (it says <b>Home</b> to start). Choose a page to switch to it, <b>Add page</b> for a new one from a template, or <b>Pages &amp; menu</b> to rename, reorder, hide from the menu or delete pages.</p>' },
    { id: 'menu-style', cat: 'pages', title: 'Choose a menu style',
      keys: 'menu navigation nav style tab bar hamburger links pills underline',
      body: '<p>' + D.click + ' your site\'s header and choose <b>Logo &amp; menu</b>. Computers and phones each keep their own layout: switch between <b>Computer</b> and <b>Phone</b> at the top of the panel. Computers have styles like Simple links, Underline, Pills and Outlined. Phones can use a <b>Menu button</b> or a <b>Tab bar</b> along the bottom, like an app.</p>' },
    { id: 'logo-placement', cat: 'pages', title: 'Center your logo or move the menu',
      keys: 'header logo left centered position placement layout',
      body: '<p>' + D.click + ' your site\'s header and choose <b>Logo &amp; menu</b>. Pick <b>Logo left</b> or <b>Logo centered</b>. Set it separately for computers and phones so each looks right.</p>' },

    /* preview and saving */
    { id: 'preview-devices', cat: 'save', title: 'See your site on a computer, tablet or phone',
      keys: 'preview device phone tablet computer mobile desktop responsive size view',
      body: '<p><span data-only="pc">Use <b>Computer</b>, <b>Tablet</b> and <b>Phone</b> in the top bar.</span><span data-only="touch">Open the <b>⋯</b> menu and choose <b>Computer</b>, <b>Tablet</b> or <b>Phone</b> under Preview.</span> You keep editing in every preview size. Your site adjusts itself to each screen, so you design once.</p>' },
    { id: 'full-screen', cat: 'save', title: 'See your site full screen',
      keys: 'full screen fullscreen preview visitor whole screen big view present show customer hide toolbar edge to edge expand maximize',
      body: '<p><span data-only="pc">Click <b>Full screen</b> in the top bar</span><span data-only="touch">Open the <b>⋯</b> menu and choose <b>Full screen</b> under Preview</span>. The studio steps aside and your site fills the screen, exactly the way a visitor will see it. The menu, buttons and slideshows all work, so you can click around your pages.</p><p>It uses the preview you picked. <b>Computer</b> fills your whole screen. <b>Tablet</b> and <b>Phone</b> show the device on a dark background when you are on a bigger screen.</p><p>To go back to editing, <span data-only="pc">press <b>Esc</b> or </span>' + D.click.toLowerCase() + ' <b>Exit full screen</b> in the top right corner.</p><p class="muted">On an iPhone, Safari keeps its own address bar on screen, but everything from the studio is hidden.</p>' },
    { id: 'undo', cat: 'save', title: 'Undo and redo',
      keys: 'undo redo mistake back revert oops ctrl z',
      body: '<p>Use <b>Undo</b> and <b>Redo</b> in the top bar. <span data-only="ph">On a phone, Redo is in the <b>⋯</b> menu.</span><span data-only="pc"> Keyboard: Ctrl+Z to undo and Ctrl+Shift+Z to redo (Cmd on a Mac).</span> Big changes like a new layout also show an <b>Undo</b> button in the message at the bottom of the screen.</p>' },
    { id: 'save-design', cat: 'save', title: 'Save your design and open it later',
      keys: 'save saved designs my designs keep later copy open come back lost work autosave auto save automatic',
      body: '<p>Choose <b>Save</b> in the top bar to save to <b>My designs</b>. A pink dot on Save means you have unsaved changes. Once a design is saved, your changes are also saved for you every minute and when you leave the page, and a small <b>Autosaved</b> note shows under Save. <b>Save as a copy</b> keeps the current version and starts a copy, and <b>New design</b> starts fresh. Find all of these in the <b>Designs</b> menu <span data-only="touch">or the <b>⋯</b> menu</span>.</p><p>Open <b>My designs</b> to switch between saved designs.</p><p>Without a plan, saving is free for <b>1 hour</b> from when you start a design. After that, saving turns off and saved copies are deleted, but you can keep editing for up to 24 hours. See <b>How long is my design kept?</b></p>' },
    { id: 'design-hold', cat: 'save', title: 'How long is my design kept?',
      keys: 'hour 1 hour 24 hours expire expires deleted removed timer countdown kept keep storage design storage 20 month retain how long free saving off cannot save',
      body: '<p>Designing is free. Without a plan, <b>saving is free for 1 hour</b> from when you start a design. A clock above the preview shows the time left. It gets bigger and turns yellow in the last 15 minutes, and turns red and flashes in the last 5.</p><p>When the free hour ends:</p><ul><li>Saving and autosave turn off.</li><li>Saved copies of the design are deleted to free up space.</li><li>You can keep editing the open design for up to <b>24 hours</b> from when you started it. Then it is cleared.</li></ul><p>To keep saving:</p><ul><li><b>Turn on Design storage for $20/month.</b> Saving comes back on and all your designs are kept. Cancel any time, and it stops when you choose a plan. ' + D.click + ' the clock above the preview, or find <b>Design storage</b> on the Plans page.</li><li><b>Choose a plan.</b> Your designs are kept for as long as you have it.</li></ul>' },
    { id: 'where-saved', cat: 'save', title: 'Where is my design stored?',
      keys: 'storage browser device lost cleared another computer account sync',
      body: '<p>For now your designs are saved in this browser on this device. They stay put when you close the tab, but clearing your browser data or switching devices will not bring them along. When you check out, your design is sent to us with your order, so your finished site does not depend on this browser.</p>' },

    { id: 'import-products', cat: 'sections', title: 'Import products from Shopify, Etsy, Square and more',
      keys: 'import products shopify etsy square woocommerce wix squarespace big cartel csv spreadsheet move store transfer inventory',
      body: '<p>Open the <b>Online store</b> section and choose <b>Import from Shopify, Etsy, Square…</b> above your products<span data-only="pc">, or open <b>Designs</b> and choose <b>Import products</b></span>. Pick the store you use now and follow the steps to download its product file, then choose that file. Names, descriptions, photos, prices, sale prices, sizes and colors, and stock come along.</p><p>Shopify, Big Cartel and WooCommerce stores can also be read straight from their link, with no file. Etsy needs the file: in Shop Manager open <b>Settings</b>, <b>Options</b>, <b>Download Data</b>. Any spreadsheet saved as CSV works too if it has a Name and a Price column.</p><p>You see the products before anything changes, and <b>Undo</b> takes the import back.</p>' },
    { id: 'apps-links', cat: 'sections', title: 'Link or embed DoorDash, Calendly, Instagram and other apps',
      keys: 'apps links embed doordash uber eats grubhub calendly square appointments acuity booksy vagaro opentable resy google reviews yelp instagram tiktok youtube spotify google forms typeform etsy shopify amazon',
      body: '<p>Add the <b>Apps &amp; links</b> section from Sections. For each app, pick it from the list and paste the link to your page on that app. <b>Buttons</b> and <b>Cards</b> show a button for each one.</p><p>With the <b>Embedded</b> layout, Calendly, Square Appointments and Acuity booking, YouTube videos, Instagram and TikTok posts, Spotify, and Google Forms, Typeform and Jotform show right on your page. You can paste the app\'s embed code instead of a link.</p>' },

    /* plans */
    { id: 'plans', cat: 'launch', title: 'Choose a plan',
      keys: 'plans pricing price cost starter growth pro monthly yearly buy purchase pay',
      body: '<p>' + D.next + '. Plans have a one-time design fee and a monthly price:</p><ul><li><b>Starter</b>: $299, then $19 a month. Up to 6 sections, a free thinkwebpros.com address, hosting and SSL.</li><li><b>Growth</b>: $599, then $39 a month. Up to 10 sections, your own domain and email, and 1 hour of edits by our team each month.</li><li><b>Pro</b>: $1,199, then $79 a month. Up to 20 sections, SEO boost and live chat, no Think Web Pros badge, and 3 hours of edits each month.</li></ul><p>Choose <b>Yearly</b> for 2 months free.</p>' },
    { id: 'addons', cat: 'launch', title: 'Add services: booking, store, domain, SEO and more',
      keys: 'add ons services booking appointments online store shop domain email seo live chat copywriting photo shoot badge',
      body: '<p>Under <b>Add-ons</b> on the plans page, turn on what your business needs: online booking, an online store, a custom domain and email, an SEO boost, live chat, professional copywriting, an on-site photo shoot and more. Items your plan already includes are marked <b>Included</b>.</p>' },
    { id: 'pos', cat: 'launch', title: 'Point of sale for in-person sales',
      keys: 'pos point of sale card reader register in person hardware terminal',
      body: '<p>The plans page also offers a point of sale system for in-person sales, with card readers and register hardware. It syncs with your website store, so your products and sales live in one place.</p>' },
    { id: 'checkout', cat: 'launch', title: 'Why can\'t I check out yet?',
      keys: 'checkout cant continue required missing info blocked next disabled',
      body: '<p>Before checkout we need your business name, phone, email, street address and a short description. ' + D.design + ', open <b>Business</b>, and fill in any card marked with a pink dot. The circle on <b>Your business</b> shows how many are done, like 3/5.</p>' },
    { id: 'dashboard', cat: 'launch', title: 'The owner dashboard',
      keys: 'owner dashboard leads messages visits analytics sales',
      body: '<p>The <b>Owner dashboard</b> shows messages and leads from your site, website visits and, if you use the point of sale, your register sales. <span data-only="pc">Open it from the main menu: click the Think Web Pros logo in the top left.</span><span data-only="tab">Open it from the main menu, the logo button in the top left.</span><span data-only="ph">Open it from the <b>☰</b> main menu.</span></p>' },

    /* devices */
    { id: 'phone-tips', cat: 'devices', title: 'Designing on a phone',
      keys: 'phone mobile iphone android small screen bottom sheet swipe menu',
      body: '<ul><li>The <b>☰</b> button opens the main menu: My designs, Owner dashboard, Plans and Help.</li><li>The <b>palette</b> button opens the Design panel. It slides up from the bottom so your page stays in view.</li><li>Swipe sideways inside the panel to move between cards, or tap the names along the top.</li><li>Drag the small handle at the top of the panel to make it taller or shorter.</li><li>The <b>⋯</b> menu holds Sections, Redo, preview sizes, the dark version and saving options.</li><li>The <b>pink arrow</b> goes to plans.</li></ul>' },
    { id: 'tablet-tips', cat: 'devices', title: 'Designing on a tablet',
      keys: 'tablet ipad touch landscape portrait',
      body: '<ul><li>Tap any words or photos to edit them, just like on a computer.</li><li>Tap <b>Design</b> to open the Design panel at the bottom. Swipe sideways to move between cards.</li><li>Preview sizes and saving options are in the <b>⋯</b> menu, and Help is in the main menu (the logo button in the top left) and the <b>⋯</b> menu.</li><li>Turning the tablet sideways gives you a wider top bar with more buttons showing.</li></ul>' },
    { id: 'computer-tips', cat: 'devices', title: 'Designing on a computer',
      keys: 'computer laptop desktop mouse keyboard shortcuts',
      body: '<ul><li>Edit panels open across the bottom so your page stays visible above them. Use the arrows or the names along the top to move between cards.</li><li>Drag sections by their dotted grip, and drag photos straight onto a picture spot.</li><li>Press <b>?</b> anywhere in the studio to open Help.</li><li>Ctrl+Z undoes and Ctrl+Shift+Z redoes (Cmd on a Mac).</li></ul>' },

    /* trouble */
    { id: 'panel-gone', cat: 'trouble', title: 'The edit panel disappeared',
      keys: 'panel closed missing gone design panel cant find settings hidden',
      body: '<p>' + D.design + ' to open it again. To edit one section, select it first by its name tag, then choose <b>Edit</b>.</p>' },
    { id: 'cant-see-page', cat: 'trouble', title: 'The panel covers my page',
      keys: 'covered blocking cant see page panel too big sheet small screen',
      body: '<p>The panel scrolls the section you are editing into view above it. <span data-only="touch">Drag the handle at the top of the panel down to make it shorter, or close it with ✕.</span><span data-only="pc">Close it with ✕ when you are done, or switch the preview to Phone to see more of the page at once.</span></p>' },
    { id: 'report-problem', cat: 'trouble', title: 'Report a problem or bug',
      keys: 'report problem bug issue broken error not working glitch crash feedback wrong screenshot',
      body: '<p>If something doesn\'t work the way it should, choose <b>Report a problem</b> at the top of this Help panel. <span data-only="pc">It is also in the main menu (the logo button in the top left).</span><span data-only="touch">It is also in the main menu (the logo button in the top left) and the <b>⋯</b> menu.</span></p><ol><li>Say what you were doing and what went wrong.</li><li>Add your email if you\'d like to hear back when it\'s fixed.</li><li>Add a screenshot if you can: choose a picture, drag one in, or paste it with <b>Ctrl+V</b>.</li></ol><p>Your report includes the page you were on, your browser and screen size, the preview you had open and any errors the page noticed, so we can find the problem faster. It never includes your design or photos.</p>' },
    { id: 'help', cat: 'trouble', title: 'Get more help',
      keys: 'help support contact question stuck human person',
      body: '<p>Search this Help panel with a few words, like "logo" or "add page". To see the main controls again, choose <b>Take the tour</b> at the top of this panel. If something is broken, choose <b>Report a problem</b> there and tell us what happened. Once your site is live, every plan includes support from our team, and Growth and Pro include edits done for you each month.</p>' }
  ];

  /* search: every word must match somewhere; titles and keywords count more than body text */
  function strip(html) { return String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|’/g, "'"); }
  articles.forEach(function (a) { a._t = a.title.toLowerCase(); a._k = a.keys.toLowerCase(); a._b = strip(a.body).toLowerCase(); });
  function search(q) {
    var words = String(q || '').toLowerCase().replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!words.length) return [];
    var out = [];
    articles.forEach(function (a) {
      var score = 0, all = true;
      words.forEach(function (w) {
        var stem = w.length > 4 ? w.replace(/(ing|es|s)$/, '') : w, s = 0;
        if (a._t.indexOf(stem) > -1) s += 6;
        if (a._k.indexOf(stem) > -1) s += 4;
        if (a._b.indexOf(stem) > -1) s += 1;
        if (!s) all = false;
        score += s;
      });
      if (all && score) out.push([score, a]);
    });
    return out.sort(function (x, y) { return y[0] - x[0]; }).map(function (x) { return x[1]; });
  }

  return { cats: cats, articles: articles, search: search };
})();
