(function(){
  var form=document.getElementById('project-form');
  var next=document.getElementById('form-next');
  var file=document.getElementById('project-file');
  var fileName=document.getElementById('file-name');

  function setReturnUrl(){
    if(!next) return;
    try{next.value=new URL('./thanks.html',window.location.href).href;}catch(error){}
  }

  setReturnUrl();

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
