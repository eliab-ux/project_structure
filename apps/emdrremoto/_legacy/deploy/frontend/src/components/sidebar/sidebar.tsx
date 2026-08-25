import React from "react";
import { Link } from "react-router-dom";
import Modal from "../modals/modal";
import FloatButton from "./FloatButton";
interface ISideBarProps {
  menuitems: any;
}

const itemStyle = "flex p-4 text-sm cursor-pointer hover:bg-gray-300 font-custom"
const focus = "flex p-4 text-sm cursor-pointer bg-red-700 text-white font-custom"

export default class Sidebar extends React.Component<ISideBarProps, any> {
  constructor(props: ISideBarProps) {
    super(props)

    this.state = {
      rota: ''
    }

    this.updateRota = this.updateRota.bind(this)
  }

  componentDidMount(){
    this.updateRota()
  }

  updateRota(){
    this.setState({rota: window.location.pathname},() => this.setState({rota: window.location.pathname}))
  }

  render() {
    return (
      <>
      <div className="sticky top-0 hidden min-h-screen bg-gray-200 lg:block">
        {this.props.menuitems.map((item: any, index: any) =>
        <Link onClick={this.updateRota} to={item.rota}>

          <div key={"div-menu-desktop" + index} className={ item.rota == this.state.rota? focus : itemStyle}>
            <div key={"icone-desktop" + index} className="pr-5">{item.icone}</div>
            <div key={"text-desktop" + index} className="pr-5">{item.text}</div>
          </div>
        </Link>
        )}
        <div className={itemStyle}>
          <button>Logout</button>
        </div>
      </div>

      <div className="block lg:hidden">

        <Modal openModalComponent={FloatButton}>

        {this.props.menuitems.map((item: any, index: any) =>
        <Link onClick={this.updateRota} to={item.rota}>
          <div key={"div" + index}  className={ item.rota == this.state.rota? focus : itemStyle }>
            <div key={"icone" + index} className="pr-2">{item.icone}</div>
            <div key={"text" + index} className="">{item.text}</div>
          </div>
        </Link>
        )}
        <div className="p-4">
          <button>Logout</button>
        </div>
        </Modal>
        </div>
      </>
    );
  }
}
