let openDialogHandler = null;

export function setAppDialogHandler(handler){
  openDialogHandler = typeof handler === "function" ? handler : null;
}

export function appAlert(message,title="Aviso"){
  if(typeof openDialogHandler!=="function"){
    console.warn(String(message||""));
    return Promise.resolve(true);
  }
  return openDialogHandler({type:"alert",title,message:String(message||"")});
}

export function appConfirm(message,title="Confirmar acción"){
  if(typeof openDialogHandler!=="function")return Promise.resolve(false);
  return openDialogHandler({type:"confirm",title,message:String(message||"")});
}
