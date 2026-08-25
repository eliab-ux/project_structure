import React from "react"
import LoginPsicologo from "../home/forms/loginPsicologo"

export default class Login extends React.Component{
  render(){
    return(
      <div className="grid grid-cols-12 min-h-screen bg-gray-50 lg:p-10">
        <div className="col-span-10 col-start-2 lg:col-span-8 lg:col-start-3">
          <LoginPsicologo />
        </div>
      </div>
    )
  }
}