import React from "react";
import { hide, show } from "../../pages/emdr/icons";
import { handleInputStyle, inputStyle, labelStyle } from "./inputStyle";

interface IInputProps {
    placeholder: string
    type: string
    name: string
    value?: any
    label?: any
}

interface IInputState{
    value: any
    dinamicType: any
}

export default class InputCustom extends React.Component<IInputProps, IInputState>{
    constructor(props: IInputProps) {
        super(props)
        this.state = {
            value: '',
            dinamicType: 'password'
        }
        this.changeValue = this.changeValue.bind(this)
        this.changeType = this.changeType.bind(this)
    }

    componentDidMount(){
        this.props.value? this.setState({value: this.props.value}): this.setState({value: ''})
    }

    changeValue = (event: any) => this.setState({value: event.target.value})
    changeType(event: any){
        event.preventDefault();
        if(this.state.dinamicType === 'password'){
            this.setState({dinamicType: 'text'})
        } else{this.setState({dinamicType: 'password'})}
    } 

    render() {
        return (
                <label className={labelStyle}> {this.props.label}
            <div className={ inputStyle + " flex"}>
                    <input 
                required
                autoComplete={this.props.name==="cpf" || this.props.name ==="pesquisa"? "off" : "on"}
                className={handleInputStyle}
                placeholder={this.props.label? '' : this.props.placeholder} 
                name={this.props.name}
                type={this.props.type==='password'? this.state.dinamicType : this.props.type }
                value={this.state.value}
                onChange={this.changeValue}
                />
                 {this.props.type==='password'?
                <button tabIndex={-1} onClick={(event) => this.changeType(event)}> {this.state.dinamicType === 'password'? show : hide} </button>: null
            } 
            </div>
            </label>
        )
    }
}