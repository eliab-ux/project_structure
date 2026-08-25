import React from "react"
import Cookies from "../../../providers/Cookies.provider"

export default class BtnExit extends React.Component{
    private cookies: Cookies;
    constructor() {
        super({}, {});
        this.cookies = new Cookies();
    }
    
    exit(){
        try{
            this.cookies.logout();
            window.location.href = "/";
        }catch(error){
            console.log(error);
        }
    }
    
  render(){
    return(
        <button onClick={this.exit.bind(this)} className="px-4 py-2 mx-4 border-red-900 hover:bg-red-900 hover:text-gray-200 text-red-900 border rounded">
            Sair
        </button>
    )
  }
}