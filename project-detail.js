(function(){
  var dialog=document.getElementById('project-lightbox');
  if(!dialog) return;

  var items=Array.prototype.slice.call(document.querySelectorAll('[data-lightbox-item]'));
  var image=dialog.querySelector('.lightbox-image');
  var status=dialog.querySelector('.lightbox-status');
  var closeButton=dialog.querySelector('.lightbox-close');
  var previousButton=dialog.querySelector('.lightbox-prev');
  var nextButton=dialog.querySelector('.lightbox-next');
  var currentIndex=0;

  function showImage(index){
    currentIndex=(index+items.length)%items.length;
    var item=items[currentIndex];
    image.src=item.getAttribute('data-src');
    image.alt=item.getAttribute('data-alt')||'';
    status.textContent=String(currentIndex+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
  }

  items.forEach(function(item,index){
    item.addEventListener('click',function(){
      showImage(index);
      if(typeof dialog.showModal==='function') dialog.showModal();
    });
  });

  closeButton.addEventListener('click',function(){dialog.close();});
  previousButton.addEventListener('click',function(){showImage(currentIndex-1);});
  nextButton.addEventListener('click',function(){showImage(currentIndex+1);});
  dialog.addEventListener('click',function(event){
    if(event.target===dialog) dialog.close();
  });
  dialog.addEventListener('keydown',function(event){
    if(event.key==='ArrowLeft') showImage(currentIndex-1);
    if(event.key==='ArrowRight') showImage(currentIndex+1);
  });
})();
