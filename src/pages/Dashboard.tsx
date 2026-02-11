import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";

const Dashboard = () => {
  const { profile } = useAuth();

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-6">
          📊 <span className="gradient-text">Dashboard</span>
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Receita Hoje", value: "R$0,00", icon: "💰" },
            { label: "Pedidos Hoje", value: "0", icon: "📦" },
            { label: "Ticket Médio", value: "R$0,00", icon: "🎫" },
            { label: "Lucro Estimado", value: "R$0,00", icon: "📈" },
          ].map((card) => (
            <div key={card.label} className="glass-card p-4">
              <p className="text-2xl mb-1">{card.icon}</p>
              <p className="font-display text-xl md:text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="glass-card p-6 text-center">
          <p className="text-muted-foreground">
            O dashboard será populado automaticamente conforme os pedidos forem chegando.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Adicione itens ao cardápio e compartilhe o QR code para começar!
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
