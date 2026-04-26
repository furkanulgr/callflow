import { createContext, useContext, useState, ReactNode } from "react";

export type Product = "callflow" | "leadflow";

interface ProductContextValue {
    product: Product;
    setProduct: (p: Product) => void;
}

const ProductContext = createContext<ProductContextValue>({
    product: "callflow",
    setProduct: () => {},
});

export const ProductProvider = ({ children }: { children: ReactNode }) => {
    const [product, setProduct] = useState<Product>("callflow");
    return (
        <ProductContext.Provider value={{ product, setProduct }}>
            {children}
        </ProductContext.Provider>
    );
};

export const useProduct = () => useContext(ProductContext);
