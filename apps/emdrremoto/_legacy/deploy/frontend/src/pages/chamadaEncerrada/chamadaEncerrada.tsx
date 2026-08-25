import React from 'react'

export default class ChamadaEncerrada extends React.Component{
    render(): React.ReactNode {
        return(
            <div className='bg-gray-50 min-h-screen grid items-center justify-center'>
                <p className='text-xl font-light animate-pulse'>
                    sua chamada foi encerrada
                </p>
            </div>
        )
    }
}