import React from 'react';
import '../styles/App.css';
import buttonCustom from './buttons/button';
import InputCustom from './inputs/input-custom';
import Modal from './modals/modal';
// import Dashboard from './sidebar/dashboard';
// import { Admin, Usuario } from './sidebar/dummySidebar/dummySidebar';


export default class App extends React.Component<any, any> {
  constructor(props: any) {
    super(props)
  }

  render() {
    return (
      <div className="App">
        <header className="flex flex-col items-center justify-center min-h-screen p-10 text-white bg-gray-800">
          <p className="p-5 text-lg font-semibold">
            Laboratório
          </p>
          <div className="grid w-1/2 grid-cols-1 gap-1 p-10 bg-gray-700">
            <p className="w-full font-light text-gray-400">Chame os componentes aqui dentro</p>

            <InputCustom value="João" name="nome" type="text" placeholder="digite seu nome" />
            <InputCustom name="nome" type="password" placeholder="digite seu nome" />

            <Modal openModalComponent={buttonCustom} content={buttonCustom} />
            <Modal openModalComponent={buttonCustom}>
                <p>coisa pra renderizar dentro do modal</p>
            </Modal>

            <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />

          </div>
        </header>
            {/* <Dashboard currentComponent={buttonCustom} menuItemGroup={Usuario} /> */}
      </div>
    );
  }

}

