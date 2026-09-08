(function(){
  var form=document.getElementById('project-form');
  var next=document.getElementById('form-next');
  var file=document.getElementById('project-file');
  var fileName=document.getElementById('file-name');
  var openDropdown=null;

  function setReturnUrl(){
    if(!next) return;
    try{next.value=new URL('./thanks.html',window.location.href).href;}catch(error){}
  }

  function closeOpenDropdown(returnFocus){
    if(openDropdown) openDropdown.close(Boolean(returnFocus));
  }

  function enhanceSelect(select){
    var field=select.closest('.form-field');
    var label=field&&field.querySelector('label[for="'+select.id+'"]');
    var options=Array.prototype.filter.call(select.options,function(option){
      return !option.disabled&&option.value!=='';
    });
    var root=document.createElement('div');
    var trigger=document.createElement('button');
    var value=document.createElement('span');
    var arrow=document.createElement('span');
    var menu=document.createElement('div');
    var optionButtons=[];
    var widget;

    if(!field||!options.length) return;

    root.className='custom-select';
    trigger.type='button';
    trigger.className='custom-select-trigger';
    trigger.id=select.id+'-trigger';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-controls',select.id+'-menu');

    value.className='custom-select-value';
    value.id=select.id+'-value';
    arrow.className='custom-select-arrow';
    arrow.setAttribute('aria-hidden','true');
    trigger.appendChild(value);
    trigger.appendChild(arrow);

    if(label){
      if(!label.id) label.id=select.id+'-label';
      label.setAttribute('for',trigger.id);
      trigger.setAttribute('aria-labelledby',label.id+' '+value.id);
      select.setAttribute('aria-labelledby',label.id);
    }else{
      trigger.setAttribute('aria-label',select.name);
      select.setAttribute('aria-label',select.name);
    }

    menu.className='custom-select-menu';
    menu.id=select.id+'-menu';
    menu.setAttribute('role','listbox');
    menu.setAttribute('aria-labelledby',label?label.id:trigger.id);
    menu.setAttribute('aria-hidden','true');

    options.forEach(function(option,optionIndex){
      var button=document.createElement('button');
      var text=document.createElement('span');
      var marker=document.createElement('span');

      button.type='button';
      button.className='custom-select-option';
      button.id=select.id+'-option-'+optionIndex;
      button.setAttribute('role','option');
      button.setAttribute('aria-selected','false');
      button.setAttribute('tabindex','-1');
      button.setAttribute('data-value',option.value);

      text.className='custom-select-option-text';
      text.textContent=option.text;
      marker.className='custom-select-option-marker';
      marker.setAttribute('aria-hidden','true');
      button.appendChild(text);
      button.appendChild(marker);
      menu.appendChild(button);
      optionButtons.push(button);

      button.addEventListener('click',function(){
        choose(option.value);
      });
    });

    root.appendChild(trigger);
    root.appendChild(menu);
    select.insertAdjacentElement('afterend',root);
    select.classList.add('custom-select-native');
    select.setAttribute('tabindex','-1');

    function selectedButtonIndex(){
      var selectedValue=select.value;
      var found=-1;
      options.some(function(option,optionIndex){
        if(option.value===selectedValue){found=optionIndex;return true;}
        return false;
      });
      return found;
    }

    function update(){
      var selected=select.options[select.selectedIndex];
      var hasValue=Boolean(select.value);
      value.textContent=selected?selected.text:'선택해주세요';
      trigger.classList.toggle('has-value',hasValue);
      trigger.setAttribute('aria-invalid','false');
      field.classList.remove('has-field-error');
      optionButtons.forEach(function(button,optionIndex){
        button.setAttribute('aria-selected',String(options[optionIndex].value===select.value));
      });
    }

    function focusOption(optionIndex){
      if(!optionButtons.length) return;
      var safeIndex=Math.max(0,Math.min(optionIndex,optionButtons.length-1));
      optionButtons[safeIndex].focus({preventScroll:true});
    }

    function placeMenu(){
      var triggerBox=trigger.getBoundingClientRect();
      var availableBelow=window.innerHeight-triggerBox.bottom;
      var availableAbove=triggerBox.top;
      var expectedHeight=Math.min(menu.scrollHeight,window.innerHeight*.48);
      root.classList.toggle('opens-up',availableBelow<expectedHeight+12&&availableAbove>availableBelow);
    }

    function open(preferredIndex){
      var initialIndex=typeof preferredIndex==='number'?preferredIndex:selectedButtonIndex();
      if(openDropdown&&openDropdown!==widget) openDropdown.close(false);
      root.classList.add('is-open');
      field.classList.add('is-dropdown-open');
      trigger.setAttribute('aria-expanded','true');
      menu.setAttribute('aria-hidden','false');
      openDropdown=widget;
      if(initialIndex<0) initialIndex=0;
      window.requestAnimationFrame(function(){
        placeMenu();
        focusOption(initialIndex);
      });
    }

    function close(returnFocus){
      root.classList.remove('is-open');
      root.classList.remove('opens-up');
      field.classList.remove('is-dropdown-open');
      trigger.setAttribute('aria-expanded','false');
      menu.setAttribute('aria-hidden','true');
      if(openDropdown===widget) openDropdown=null;
      if(returnFocus) trigger.focus({preventScroll:true});
    }

    function choose(selectedValue){
      select.value=selectedValue;
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
      update();
      close(true);
    }

    widget={root:root,close:close};

    trigger.addEventListener('click',function(){
      if(root.classList.contains('is-open')) close(false);
      else open();
    });

    trigger.addEventListener('keydown',function(event){
      if(event.key==='ArrowDown'||event.key==='Enter'||event.key===' '){
        event.preventDefault();
        open();
      }else if(event.key==='ArrowUp'){
        event.preventDefault();
        open(optionButtons.length-1);
      }else if(event.key==='Escape'){
        close(false);
      }
    });

    menu.addEventListener('keydown',function(event){
      var currentIndex=optionButtons.indexOf(document.activeElement);
      if(event.key==='ArrowDown'){
        event.preventDefault();
        focusOption(currentIndex<0?0:(currentIndex+1)%optionButtons.length);
      }else if(event.key==='ArrowUp'){
        event.preventDefault();
        focusOption(currentIndex<=0?optionButtons.length-1:currentIndex-1);
      }else if(event.key==='Home'){
        event.preventDefault();
        focusOption(0);
      }else if(event.key==='End'){
        event.preventDefault();
        focusOption(optionButtons.length-1);
      }else if((event.key==='Enter'||event.key===' ')&&currentIndex>=0){
        event.preventDefault();
        choose(options[currentIndex].value);
      }else if(event.key==='Escape'){
        event.preventDefault();
        close(true);
      }else if(event.key==='Tab'){
        close(false);
      }
    });

    select.addEventListener('change',update);
    select.addEventListener('invalid',function(event){
      event.preventDefault();
      field.classList.add('has-field-error');
      trigger.setAttribute('aria-invalid','true');
      if(!openDropdown) open(0);
    });

    if(form){
      form.addEventListener('reset',function(){
        window.setTimeout(update,0);
      });
    }

    update();
  }

  setReturnUrl();

  Array.prototype.forEach.call(document.querySelectorAll('select[data-custom-select]'),enhanceSelect);

  document.addEventListener('click',function(event){
    if(openDropdown&&!openDropdown.root.contains(event.target)) closeOpenDropdown(false);
  });

  window.addEventListener('resize',function(){closeOpenDropdown(false);});

  if(file&&fileName){
    file.addEventListener('change',function(){
      if(!this.files||!this.files[0]){
        fileName.textContent='파일 선택';
        return;
      }
      var selected=this.files[0];
      if(selected.size>10*1024*1024){
        alert('첨부파일은 10MB 이하로 업로드해주세요.');
        this.value='';
        fileName.textContent='파일 선택';
        return;
      }
      fileName.textContent=selected.name;
    });
  }

  if(form){form.addEventListener('submit',setReturnUrl);}
})();
