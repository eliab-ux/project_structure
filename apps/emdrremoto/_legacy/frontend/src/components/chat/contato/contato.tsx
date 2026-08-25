import React from 'react'

interface IContatoProps {
    foto: any
    nome: any
}

export default class Contato extends React.Component<IContatoProps, any>{
    constructor(props: IContatoProps) {
        super(props)
    }

    render() {
        return (
            <div className="flex w-full p-2 my-1 text-sm border border-blue-300 rounded">
                <img className="w-10 h-10 mx-1 rounded-full" src={this.props.foto} alt="" srcSet="" />
                <span className="my-auto font-semibold truncate">{this.props.nome}</span>
            </div>
        )
    }
}