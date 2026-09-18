/* X adapter: only data already rendered in the primary timeline. No private APIs. */
(() => {
  const BLOCK_TAGS=new Set(['ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DD','DIV','DL','DT','FIGCAPTION','FIGURE','FOOTER','H1','H2','H3','H4','H5','H6','HEADER','HR','LI','MAIN','NAV','OL','P','PRE','SECTION','TABLE','TBODY','TD','TH','THEAD','TR','UL']);
  const NON_TEXT_TAGS=new Set(['SCRIPT','STYLE','TEMPLATE','NOSCRIPT']);
  function postText(root) {
    let text='';
    const boundary=()=>{if(text&&!text.endsWith('\n'))text+='\n';};
    function visit(node) {
      if(node.nodeType===Node.TEXT_NODE){text+=node.nodeValue;return;}
      if(node.nodeType!==Node.ELEMENT_NODE||NON_TEXT_TAGS.has(node.tagName))return;
      if(node.tagName==='BR'){text+='\n';return;}
      if(node.tagName==='IMG'){text+=node.getAttribute('alt')||'';return;}
      const block=BLOCK_TAGS.has(node.tagName);
      if(block)boundary();
      for(const child of node.childNodes)visit(child);
      if(block)boundary();
    }
    // innerText changes when collapse/hide removes a post from layout. Read the
    // semantic DOM instead so treatment never changes the evaluated identity.
    // Preserve inline whitespace, explicit breaks, block boundaries and X emoji.
    visit(root);return text.trim();
  }
  function extract(article) {
    if(!(article instanceof HTMLElement)||!article.matches('article[data-testid="tweet"]'))return null;
    if(article.closest('[role="dialog"],[data-testid="DMDrawer"],[data-testid="conversation"],[data-testid="messageEntry"]'))return null;
    const blocks=[...article.querySelectorAll('[data-testid="tweetText"]')];
    const text=blocks.map(postText).filter(Boolean).join('\n[Quoted context]\n').trim();
    if(text.length<3)return null;
    const href=article.querySelector('time')?.closest('a')?.getAttribute('href')||'';
    const id=href.match(/\/status\/(\d+)/)?.[1];
    if(!id)return null;
    return {id,text:text.slice(0,6000),has_link:blocks.some(n=>!!n.querySelector('a[href^="http"]')),has_media:!!article.querySelector('[data-testid="tweetPhoto"],[data-testid="videoPlayer"]'),truncated:text.length>6000||!!article.querySelector('[data-testid="tweet-text-show-more-link"]')};
  }
  const AD_LABELS=new Set([
    'ad','promoted','sponsored','sponsorizzato','pubblicità','anuncio','promocionado',
    'publicidad','gesponsert','anzeige','sponsorisé','publicité','promovido','patrocinado',
    '广告','廣告','広告','광고','프로모션'
  ]);
  function isAd(article) {
    if(!(article instanceof HTMLElement)||!article.matches('article[data-testid="tweet"]'))return false;
    for(const node of article.querySelectorAll('span,div')){
      if(node.children.length||!AD_LABELS.has((node.textContent||'').trim().toLocaleLowerCase()))continue;
      // A post may discuss ads, or even be authored by an account named "Ad".
      // X's disclosure lives in tweet chrome, outside author/content/media nodes.
      if(node.closest('[data-testid="tweetText"],[data-testid="User-Name"],[data-testid="card.wrapper"],[data-testid="tweetPhoto"],[data-testid="videoPlayer"]'))continue;
      return true;
    }
    return false;
  }
  function articles() {return [...document.querySelectorAll('main article[data-testid="tweet"]')];}
  globalThis.OYA_X=Object.freeze({extract,isAd,articles});
})();
