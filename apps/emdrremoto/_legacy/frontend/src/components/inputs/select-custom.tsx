import React from 'react'

interface ISelectProps{
  options: any
  handleChange: any
  name: any
}

export default class SelectCustom extends React.Component<ISelectProps, any>{
  render(){
    return(
      <select className="p-2 w-20 h-12 text-sm text-white bg-gray-800 rounded outline-none" name={this.props.name} onChange={this.props.handleChange}>
          {this.props.options.map(
            (item: any, index: any) => <option className="p-3 text-white" key={index + 'sound'} value={item.value}>{item.name}</option>
          )}
        </select>
    )
  }
}