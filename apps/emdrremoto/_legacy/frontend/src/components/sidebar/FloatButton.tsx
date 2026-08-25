import React from "react";

export default class FloatButton extends React.Component<any, any>{
    constructor(props: any){
        super(props)
    }

    render(){
        return(
            <button className="fixed z-40 p-5 mb-10 mr-10 font-bold text-white transition-all duration-150 ease-linear transform bg-blue-700 rounded-full shadow right-2 bottom-2 outline-zero hover:text-blue-700 hover:scale-110"
                type="button">

Clique aqui
            </button>
        )
    }

}
